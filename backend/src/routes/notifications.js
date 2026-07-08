import { Router } from "express";
import { prisma } from "../utils/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { listNotifications, unreadCount, markRead, markAllRead } from "../services/notifications.js";

const router = Router();

// list notifications for current user
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const notifications = await listNotifications(req.user.id, 30);
    // normalize for client
    const out = notifications.map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type,
      targetUrl: n.targetUrl || null,
      read: Boolean(n.readAt),
      readAt: n.readAt || null,
      createdAt: n.createdAt
    }));
    res.json({ notifications: out });
  } catch (err) {
    next(err);
  }
});

router.get("/unread-count", requireAuth, async (req, res, next) => {
  try {
    const count = await unreadCount(req.user.id);
    res.json({ count });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/read", requireAuth, async (req, res, next) => {
  try {
    const updated = await markRead(req.user.id, req.params.id);
    if (!updated) return res.status(404).json({ error: "Notification not found." });
    res.json({ notification: { id: updated.id, read: Boolean(updated.readAt), readAt: updated.readAt } });
  } catch (err) {
    next(err);
  }
});

router.patch("/read-all", requireAuth, async (req, res, next) => {
  try {
    await markAllRead(req.user.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
