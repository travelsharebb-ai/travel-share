import { Router } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma.js";
import { notifyReportedUpload } from "../utils/email.js";
import { isPlatformAdmin } from "../middleware/auth.js";

const router = Router();

async function ownedUpload(userId, uploadId) {
  return prisma.upload.findFirst({
    where: { id: uploadId, OR: [{ trip: { userId } }, { event: { organizerId: userId } }] },
    include: { trip: true, event: true }
  });
}

async function manageableUpload(req, uploadId) {
  if (isPlatformAdmin(req.user)) {
    return prisma.upload.findUnique({ where: { id: uploadId }, include: { trip: true, event: true } });
  }
  return ownedUpload(req.user.id, uploadId);
}

router.get("/trips/:tripId/uploads", async (req, res) => {
  const trip = await prisma.trip.findFirst({ where: { id: req.params.tripId, userId: req.user.id } });
  if (!trip) return res.status(404).json({ error: "Trip not found." });

  const status = req.query.status;
  const uploads = await prisma.upload.findMany({
    where: { tripId: trip.id, status: status || undefined },
    orderBy: { createdAt: "desc" }
  });
  res.json({ uploads });
});

router.patch("/uploads/:uploadId/approve", async (req, res) => {
  const upload = await manageableUpload(req, req.params.uploadId);
  if (!upload) return res.status(404).json({ error: "Upload not found." });

  const updated = await prisma.upload.update({
    where: { id: upload.id },
    data: { status: "approved", approvedAt: new Date(), rejectedAt: null }
  });
  res.json({ upload: updated });
});

router.patch("/uploads/:uploadId/reject", async (req, res) => {
  const upload = await manageableUpload(req, req.params.uploadId);
  if (!upload) return res.status(404).json({ error: "Upload not found." });

  const updated = await prisma.upload.update({
    where: { id: upload.id },
    data: { status: "rejected", rejectedAt: new Date(), approvedAt: null }
  });
  res.json({ upload: updated });
});

router.patch("/uploads/:uploadId/report", async (req, res, next) => {
  try {
    const schema = z.object({
      reportReason: z.string().min(3).max(500).optional(),
      blockUploader: z.boolean().optional()
    });
    const data = schema.parse(req.body);
    const upload = await manageableUpload(req, req.params.uploadId);
    if (!upload) return res.status(404).json({ error: "Upload not found." });

    const updated = await prisma.upload.update({
      where: { id: upload.id },
      data: { status: "reported", reportReason: data.reportReason || "Reported by album owner" },
      include: { trip: true }
    });

    if (data.blockUploader && upload.tripId) {
      await prisma.blockedUploader.upsert({
        where: {
          tripId_uploaderFingerprint: {
            tripId: upload.tripId,
            uploaderFingerprint: upload.uploaderFingerprint
          }
        },
        update: { reason: data.reportReason || "Reported by album owner" },
        create: {
          tripId: upload.tripId,
          uploaderFingerprint: upload.uploaderFingerprint,
          reason: data.reportReason || "Reported by album owner"
        }
      });
    }

    notifyReportedUpload({ upload: updated }).catch((error) => {
      console.error("Reported upload notification failed", error);
    });

    res.json({ upload: updated });
  } catch (error) {
    next(error);
  }
});

router.delete("/uploads/:uploadId", async (req, res) => {
  const upload = await manageableUpload(req, req.params.uploadId);
  if (!upload) return res.status(404).json({ error: "Upload not found." });
  await prisma.upload.delete({ where: { id: upload.id } });
  res.status(204).end();
});

router.post("/trips/:tripId/uploads/bulk", async (req, res, next) => {
  try {
    const schema = z.object({
      uploadIds: z.array(z.string()).min(1),
      action: z.enum(["approve", "reject"])
    });
    const data = schema.parse(req.body);
    const trip = await prisma.trip.findFirst({ where: { id: req.params.tripId, userId: req.user.id } });
    if (!trip) return res.status(404).json({ error: "Trip not found." });

    const result = await prisma.upload.updateMany({
      where: { id: { in: data.uploadIds }, tripId: trip.id },
      data: data.action === "approve"
        ? { status: "approved", approvedAt: new Date(), rejectedAt: null }
        : { status: "rejected", rejectedAt: new Date(), approvedAt: null }
    });

    res.json({ count: result.count });
  } catch (error) {
    next(error);
  }
});

export default router;
