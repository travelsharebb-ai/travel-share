import { Router } from "express";
import { prisma } from "../utils/prisma.js";
import { isPlatformAdmin } from "../middleware/auth.js";
import { finalizePaidTransaction, updateTransactionPaymentStatus } from "../services/paymentFinalizationService.js";
import { capturePaypalOrder, createPaypalOrder, createStripeCheckout, getPaymentCurrency, verifyStripeCheckout } from "../utils/payments.js";
import { ensureBasicSkinUnlocks } from "../utils/skins.js";

const router = Router();

router.get("/", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Please sign up or log in to purchase or download this item." });
  await ensureBasicSkinUnlocks(req.user.id).catch((error) => {
    console.error("Failed to grant basic skins while loading store", error);
  });
  const [items, purchases, skinUnlocks] = await Promise.all([
    prisma.purchaseItem.findMany({ where: { active: true }, orderBy: [{ type: "asc" }, { updatedAt: "desc" }] }),
    prisma.userPurchase.findMany({ where: { userId: req.user.id }, select: { itemId: true } }),
    prisma.userSkinUnlock.findMany({ where: { userId: req.user.id }, select: { skinId: true } })
  ]);
  const owned = new Set(purchases.map((purchase) => purchase.itemId));
  skinUnlocks.forEach((unlock) => owned.add(unlock.skinId));
  res.json({ items: items.map((item) => ({ ...item, owned: owned.has(item.id) })) });
});

router.post("/:itemId/purchase", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Please sign up or log in to purchase or download this item." });
  const item = await prisma.purchaseItem.findFirst({ where: { id: req.params.itemId, active: true } });
  if (!item) return res.status(404).json({ error: "Store item not found." });
  if (item.priceCents > 0 && process.env.ALLOW_DEV_PURCHASES !== "true") {
    return res.status(402).json({ error: "Paid add-ons require checkout. Use Stripe or PayPal." });
  }
  const purchase = await prisma.userPurchase.upsert({
    where: { userId_itemId: { userId: req.user.id, itemId: item.id } },
    update: { status: "owned" },
    create: { userId: req.user.id, itemId: item.id, status: "owned" }
  });
  if (item.type === "image_skin") {
    await prisma.userSkinUnlock.upsert({
      where: { id: `${req.user.id}_${item.id}` },
      update: {},
      create: { id: `${req.user.id}_${item.id}`, userId: req.user.id, skinId: item.id }
    });
  }
  res.status(201).json({ purchase, message: "Add-on unlocked. Payment checkout can be connected later." });
});

router.post("/:itemId/checkout", async (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: "Please sign up or log in to purchase or download this item." });
  try {
    const provider = ["stripe", "paypal"].includes(req.body?.provider) ? req.body.provider : "stripe";
    const item = await prisma.purchaseItem.findFirst({ where: { id: req.params.itemId, active: true } });
    if (!item) return res.status(404).json({ error: "Store item not found." });
    if (item.priceCents <= 0) return res.status(400).json({ error: "Free items can be unlocked directly." });
    if (provider === "stripe" && !process.env.STRIPE_SECRET_KEY) {
      return res.status(501).json({ error: "Stripe is not configured. Set STRIPE_SECRET_KEY." });
    }
    if (provider === "paypal" && (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET)) {
      return res.status(501).json({ error: "PayPal is not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET." });
    }

    const transaction = await prisma.paymentTransaction.create({
      data: {
        userId: req.user.id,
        itemId: item.id,
        provider,
        amountCents: item.priceCents,
        currency: provider === "stripe" ? getPaymentCurrency() : "usd"
      }
    });

    const result = provider === "paypal"
      ? await createPaypalOrder({ item, user: req.user, transaction })
      : await createStripeCheckout({ item, user: req.user, transaction });

    const updatedTransaction = await prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        currency: result.currency || transaction.currency,
        providerPaymentId: result.providerPaymentId || null,
        providerRef: result.providerRef || null,
        checkoutUrl: result.checkoutUrl || null,
        rawResponse: result.rawResponse || undefined
      }
    });

    res.status(201).json({ transaction: updatedTransaction, checkoutUrl: result.checkoutUrl, provider });
  } catch (error) {
    next(error);
  }
});

router.post("/payments/:transactionId/confirm", async (req, res, next) => {
  try {
    const transaction = await prisma.paymentTransaction.findFirst({
      where: {
        id: req.params.transactionId,
        ...(isPlatformAdmin(req.user) ? {} : { userId: req.user.id })
      },
      include: { item: true }
    });
    if (!transaction) return res.status(404).json({ error: "Payment transaction not found." });
    if (transaction.status === "paid") return res.json({ status: "paid", item: transaction.item });
    if (!transaction.providerRef) return res.status(400).json({ error: "Payment transaction has no provider reference." });

    const result = transaction.provider === "paypal"
      ? await capturePaypalOrder(transaction.providerRef)
      : await verifyStripeCheckout(transaction.providerRef);

    if (result.paid) {
      const finalized = await finalizePaidTransaction(transaction.id, {
        providerPaymentId: result.providerPaymentId,
        currency: result.currency,
        rawResponse: result.rawResponse
      });
      return res.json({ status: finalized.transaction.status, item: transaction.item });
    }

    const nextStatus = ["expired", "canceled"].includes(result.status) ? "canceled" : "pending";
    const updated = await updateTransactionPaymentStatus(transaction.id, nextStatus, {
      providerPaymentId: result.providerPaymentId,
      currency: result.currency,
      rawResponse: result.rawResponse
    });

    res.json({ status: updated.status, item: transaction.item });
  } catch (error) {
    next(error);
  }
});

router.post("/:itemId/activate", async (req, res, next) => {
  try {
    const itemId = req.params.itemId;
    const item = await prisma.purchaseItem.findFirst({ where: { id: itemId, active: true } });
    if (!item) return res.status(404).json({ error: "Store item not found." });

    const owned = await prisma.userPurchase.findUnique({
      where: { userId_itemId: { userId: req.user.id, itemId } }
    });
    if (!owned || owned.status !== "owned") return res.status(403).json({ error: "You do not own this item." });

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { activeStoreItemId: itemId },
      include: { activeStoreItem: true }
    });

    res.json({ activeStoreItem: user.activeStoreItem });
  } catch (error) {
    next(error);
  }
});

router.delete("/activate", async (req, res, next) => {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { activeStoreItemId: null }
    });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
