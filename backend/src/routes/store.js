import { Router } from "express";
import { prisma } from "../utils/prisma.js";
import { capturePaypalOrder, createPaypalOrder, createStripeCheckout, verifyStripeCheckout } from "../utils/payments.js";

const router = Router();

router.get("/", async (req, res) => {
  const [items, purchases] = await Promise.all([
    prisma.purchaseItem.findMany({ where: { active: true }, orderBy: [{ type: "asc" }, { updatedAt: "desc" }] }),
    prisma.userPurchase.findMany({ where: { userId: req.user.id }, select: { itemId: true } })
  ]);
  const owned = new Set(purchases.map((purchase) => purchase.itemId));
  res.json({ items: items.map((item) => ({ ...item, owned: owned.has(item.id) })) });
});

router.post("/:itemId/purchase", async (req, res) => {
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
  res.status(201).json({ purchase, message: "Add-on unlocked. Payment checkout can be connected later." });
});

router.post("/:itemId/checkout", async (req, res, next) => {
  try {
    const provider = ["stripe", "paypal"].includes(req.body?.provider) ? req.body.provider : "stripe";
    const item = await prisma.purchaseItem.findFirst({ where: { id: req.params.itemId, active: true } });
    if (!item) return res.status(404).json({ error: "Store item not found." });
    if (item.priceCents <= 0) return res.status(400).json({ error: "Free items can be unlocked directly." });

    const result = provider === "paypal"
      ? await createPaypalOrder({ item, user: req.user })
      : await createStripeCheckout({ item, user: req.user });

    const transaction = await prisma.paymentTransaction.create({
      data: {
        userId: req.user.id,
        itemId: item.id,
        provider,
        amountCents: item.priceCents,
        providerRef: result.providerRef || null,
        checkoutUrl: result.checkoutUrl || null,
        rawResponse: result.rawResponse || undefined
      }
    });

    res.status(201).json({ transaction, checkoutUrl: result.checkoutUrl, provider });
  } catch (error) {
    next(error);
  }
});

router.post("/payments/:transactionId/confirm", async (req, res, next) => {
  try {
    const transaction = await prisma.paymentTransaction.findFirst({
      where: { id: req.params.transactionId, userId: req.user.id },
      include: { item: true }
    });
    if (!transaction) return res.status(404).json({ error: "Payment transaction not found." });
    if (transaction.status === "paid") return res.json({ status: "paid", item: transaction.item });
    if (!transaction.providerRef) return res.status(400).json({ error: "Payment transaction has no provider reference." });

    const result = transaction.provider === "paypal"
      ? await capturePaypalOrder(transaction.providerRef)
      : await verifyStripeCheckout(transaction.providerRef);

    const updated = await prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        status: result.paid ? "paid" : "pending",
        rawResponse: result.rawResponse || undefined
      }
    });

    if (result.paid) {
      await prisma.userPurchase.upsert({
        where: { userId_itemId: { userId: req.user.id, itemId: transaction.itemId } },
        update: { status: "owned" },
        create: { userId: req.user.id, itemId: transaction.itemId, status: "owned" }
      });
    }

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
