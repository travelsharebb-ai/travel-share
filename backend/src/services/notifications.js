import { prisma } from "../utils/prisma.js";

export async function createNotification(userId, title, message, type = "info", targetUrl = null) {
  try {
    await prisma.notification.create({
      data: { userId, title: String(title || ""), message: String(message || ""), type, targetUrl }
    });
  } catch (err) {
    console.error("createNotification failed", err?.message || err);
  }
}

export async function listNotifications(userId, limit = 30) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit
  });
}

export async function unreadCount(userId) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function markRead(userId, id) {
  // ensure owner
  const n = await prisma.notification.findUnique({ where: { id } });
  if (!n || n.userId !== userId) return null;
  return prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
}

export async function markAllRead(userId) {
  return prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
}
