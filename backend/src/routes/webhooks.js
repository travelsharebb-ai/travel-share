import crypto from "node:crypto";
import express, { Router } from "express";
import { finalizePaidTransactionByProviderRef, updateTransactionPaymentStatus } from "../services/paymentFinalizationService.js";
import { prisma } from "../utils/prisma.js";

const router = Router();
const STRIPE_TOLERANCE_SECONDS = 300;

function timingSafeEqualHex(a, b) {
  try {
    const left = Buffer.from(a, "hex");
    const right = Buffer.from(b, "hex");
    return left.length === right.length && crypto.timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

function verifyStripeSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader) {
    const error = new Error("Missing Stripe signature.");
    error.status = 400;
    throw error;
  }

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key, value];
    })
  );
  const timestamp = parts.t;
  const signatures = signatureHeader
    .split(",")
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3));

  if (!timestamp || signatures.length === 0) {
    const error = new Error("Invalid Stripe signature header.");
    error.status = 400;
    throw error;
  }

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > STRIPE_TOLERANCE_SECONDS) {
    const error = new Error("Stripe signature timestamp is outside tolerance.");
    error.status = 400;
    throw error;
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody.toString("utf8")}`)
    .digest("hex");

  if (!signatures.some((signature) => timingSafeEqualHex(signature, expected))) {
    const error = new Error("Invalid Stripe signature.");
    error.status = 400;
    throw error;
  }
}

function stripeSessionFromEvent(event) {
  return event?.data?.object && event.data.object.object === "checkout.session"
    ? event.data.object
    : null;
}

async function getOrCreateWebhookEvent(event, session) {
  const existing = await prisma.paymentWebhookEvent.findUnique({
    where: { providerEventId: event.id }
  });
  if (existing?.processed) return { record: existing, duplicateProcessed: true };
  if (existing) return { record: existing, duplicateProcessed: false };

  const transaction = session?.id
    ? await prisma.paymentTransaction.findFirst({
        where: { provider: "stripe", providerRef: session.id },
        select: { id: true }
      })
    : null;

  const record = await prisma.paymentWebhookEvent.create({
    data: {
      provider: "stripe",
      providerEventId: event.id,
      transactionId: transaction?.id || null,
      eventType: event.type,
      payload: event
    }
  });

  return { record, duplicateProcessed: false };
}

router.post("/stripe", express.raw({ type: "application/json", limit: "2mb" }), async (req, res) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("Stripe webhook rejected: STRIPE_WEBHOOK_SECRET is not configured.");
    return res.status(503).json({ error: "Stripe webhook is not configured." });
  }

  try {
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || "");
    verifyStripeSignature(rawBody, req.get("stripe-signature"), secret);

    const event = JSON.parse(rawBody.toString("utf8"));
    const session = stripeSessionFromEvent(event);
    const { record, duplicateProcessed } = await getOrCreateWebhookEvent(event, session);
    if (duplicateProcessed) return res.json({ received: true, duplicate: true });

    if (!session) {
      await prisma.paymentWebhookEvent.update({
        where: { id: record.id },
        data: {
          errorMessage: "Stripe event did not contain a checkout session.",
          processedAt: new Date()
        }
      });
      return res.json({ received: true, processed: false });
    }

    if (!record.transactionId) {
      await prisma.paymentWebhookEvent.update({
        where: { id: record.id },
        data: {
          errorMessage: `No local payment transaction found for Stripe session ${session.id}.`,
          processedAt: new Date()
        }
      });
      return res.json({ received: true, processed: false });
    }

    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      if (session.payment_status !== "paid") {
        await prisma.paymentWebhookEvent.update({
          where: { id: record.id },
          data: {
            errorMessage: `Stripe session payment_status was ${session.payment_status || "unknown"}.`,
            processedAt: new Date()
          }
        });
        return res.json({ received: true, processed: false });
      }

      const finalized = await finalizePaidTransactionByProviderRef("stripe", session.id, {
        providerPaymentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
        currency: session.currency || null,
        rawResponse: event
      });

      await prisma.paymentWebhookEvent.update({
        where: { id: record.id },
        data: {
          transactionId: finalized.transaction.id,
          processed: true,
          errorMessage: null,
          processedAt: new Date()
        }
      });

      return res.json({ received: true, processed: true });
    }

    if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
      const nextStatus = event.type === "checkout.session.expired" ? "canceled" : "failed";
      await updateTransactionPaymentStatus(record.transactionId, nextStatus, {
        providerPaymentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
        currency: session.currency || null,
        rawResponse: event
      });
      await prisma.paymentWebhookEvent.update({
        where: { id: record.id },
        data: { processed: true, errorMessage: null, processedAt: new Date() }
      });
      return res.json({ received: true, processed: true });
    }

    await prisma.paymentWebhookEvent.update({
      where: { id: record.id },
      data: {
        errorMessage: `Unhandled Stripe event type: ${event.type}`,
        processedAt: new Date()
      }
    });
    return res.json({ received: true, processed: false });
  } catch (error) {
    const status = error.status || 400;
    return res.status(status).json({ error: error.message || "Invalid Stripe webhook." });
  }
});

export default router;
