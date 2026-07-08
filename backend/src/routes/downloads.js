import { Router } from "express";
import { prisma } from "../utils/prisma.js";
import { isPlatformAdmin, requireAuth } from "../middleware/auth.js";
import { signedMediaUrl } from "../utils/cloudinary.js";

const router = Router();

async function recordDownloadAudit({ userId, uploadId, success, reason, ip }) {
  await prisma.downloadAuditLog.create({
    data: {
      userId,
      uploadId,
      success,
      reason: reason?.slice(0, 500) || null,
      ip: ip || null
    }
  });
}

router.get("/:uploadId", requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Please sign up or log in to purchase or download this item." });
  const upload = await prisma.upload.findUnique({
    where: { id: req.params.uploadId },
    include: {
      trip: { select: { userId: true } },
      event: { select: { organizerId: true } }
    }
  });
  if (!upload) {
    await recordDownloadAudit({
      userId: req.user.id,
      uploadId: req.params.uploadId,
      success: false,
      reason: "not_found",
      ip: req.ip
    });
    return res.status(404).json({ error: "Upload not found." });
  }
  const ownerAllowed = upload.trip?.userId === req.user.id || upload.event?.organizerId === req.user.id;
  const platformAdminAllowed = isPlatformAdmin(req.user);
  const allowedWithoutPurchase = ownerAllowed || platformAdminAllowed;

  if (!allowedWithoutPurchase) {
    if (!upload.downloadPurchaseItemId) {
      await recordDownloadAudit({
        userId: req.user.id,
        uploadId: upload.id,
        success: false,
        reason: "purchase_item_missing",
        ip: req.ip
      });
      return res.status(403).json({ error: "Download purchase item required." });
    }

    const purchase = await prisma.userPurchase.findUnique({
      where: { userId_itemId: { userId: req.user.id, itemId: upload.downloadPurchaseItemId } }
    });
    if (!purchase || purchase.status !== "owned") {
      await recordDownloadAudit({
        userId: req.user.id,
        uploadId: upload.id,
        success: false,
        reason: "purchase_required",
        ip: req.ip
      });
      return res.status(403).json({ error: "You must purchase this download before accessing it." });
    }
  }

  const watermarkText = req.user?.email ? `Protected ${req.user.email}` : "Protected TravelShare";
  const signedUrl = signedMediaUrl(upload, { watermarkText });
  if (!signedUrl) {
    await recordDownloadAudit({
      userId: req.user.id,
      uploadId: upload.id,
      success: false,
      reason: "signed_url_unavailable",
      ip: req.ip
    });
    return res.status(503).json({ error: "Download is currently unavailable." });
  }

  await recordDownloadAudit({
    userId: req.user.id,
    uploadId: upload.id,
    success: true,
    reason: "ok",
    ip: req.ip
  });
  res.redirect(signedUrl);
});

export default router;
