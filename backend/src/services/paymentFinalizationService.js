import { prisma } from "../utils/prisma.js";

const PAID_STATUS = "paid";

function safeRawResponse(existingRawResponse, rawResponse) {
  if (rawResponse === undefined) return existingRawResponse ?? undefined;
  return rawResponse;
}

export async function finalizePaidTransaction(transactionId, options = {}) {
  const {
    providerPaymentId,
    currency,
    rawResponse,
    status = PAID_STATUS
  } = options;

  return prisma.$transaction(async (tx) => {
    const transaction = await tx.paymentTransaction.findUnique({
      where: { id: transactionId },
      include: { item: true, user: true }
    });

    if (!transaction) {
      const error = new Error("Payment transaction not found.");
      error.status = 404;
      throw error;
    }

    if (transaction.user.role === "guest") {
      const error = new Error("Guest users cannot unlock paid store items.");
      error.status = 403;
      throw error;
    }

    const nextStatus = status === PAID_STATUS ? PAID_STATUS : transaction.status;
    const updatedTransaction = await tx.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        status: nextStatus,
        providerPaymentId: providerPaymentId ?? transaction.providerPaymentId,
        currency: currency ?? transaction.currency,
        rawResponse: safeRawResponse(transaction.rawResponse, rawResponse)
      },
      include: { item: true }
    });

    if (nextStatus !== PAID_STATUS) {
      return {
        transaction: updatedTransaction,
        purchase: null,
        skinUnlock: null
      };
    }

    const purchase = await tx.userPurchase.upsert({
      where: { userId_itemId: { userId: transaction.userId, itemId: transaction.itemId } },
      update: { status: "owned" },
      create: { userId: transaction.userId, itemId: transaction.itemId, status: "owned" }
    });

    let skinUnlock = null;
    if (transaction.item.type === "image_skin") {
      skinUnlock = await tx.userSkinUnlock.upsert({
        where: { userId_skinId: { userId: transaction.userId, skinId: transaction.itemId } },
        update: {},
        create: { userId: transaction.userId, skinId: transaction.itemId }
      });
    }

    return {
      transaction: updatedTransaction,
      purchase,
      skinUnlock
    };
  });
}

export async function finalizePaidTransactionByProviderRef(provider, providerRef, options = {}) {
  const transaction = await prisma.paymentTransaction.findFirst({
    where: { provider, providerRef },
    select: { id: true }
  });

  if (!transaction) {
    const error = new Error("Payment transaction not found.");
    error.status = 404;
    throw error;
  }

  return finalizePaidTransaction(transaction.id, options);
}

export async function updateTransactionPaymentStatus(transactionId, status, options = {}) {
  return prisma.paymentTransaction.update({
    where: { id: transactionId },
    data: {
      status,
      providerPaymentId: options.providerPaymentId,
      currency: options.currency,
      rawResponse: options.rawResponse
    },
    include: { item: true }
  });
}
