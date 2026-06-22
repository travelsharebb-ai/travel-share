import { Router } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma.js";
import { attachFrameUrls, userOwnsSkin } from "../utils/skins.js";
import { notifyReportedUpload } from "../utils/email.js";
import { isPlatformAdmin } from "../middleware/auth.js";

const router = Router();

async function ownedUpload(userId, uploadId) {
  return prisma.upload.findFirst({
    where: { id: uploadId, OR: [{ trip: { userId } }, { event: { organizerId: userId } }] },
    select: {
      id: true,
      tripId: true,
      eventId: true,
      zoneId: true,
      guestSessionId: true,
      uploaderAnonId: true,
      uploaderFingerprint: true,
      caption: true,
      fileUrl: true,
      filePublicId: true,
      fileType: true,
      status: true,
      latitude: true,
      longitude: true,
      approximateLatitude: true,
      approximateLongitude: true,
      locationName: true,
      region: true,
      locationVisibility: true,
      moderationStatus: true,
      createdAt: true,
      approvedAt: true,
      rejectedAt: true,
      trip: true,
      event: true
    }
  });
}

async function manageableUpload(req, uploadId) {
  if (isPlatformAdmin(req.user)) {
    return prisma.upload.findUnique({
      where: { id: uploadId },
      select: {
        id: true,
        tripId: true,
        eventId: true,
        zoneId: true,
        guestSessionId: true,
        uploaderAnonId: true,
        uploaderFingerprint: true,
        caption: true,
        fileUrl: true,
        filePublicId: true,
        fileType: true,
        status: true,
        latitude: true,
        longitude: true,
        approximateLatitude: true,
        approximateLongitude: true,
        locationName: true,
        region: true,
        locationVisibility: true,
        moderationStatus: true,
        createdAt: true,
        approvedAt: true,
        rejectedAt: true,
        trip: true,
        event: true
      }
    });
  }
  return ownedUpload(req.user.id, uploadId);
}

// Use batch attachFrameUrls to avoid repeated queries
async function hydrateUploads(uploads) {
  return attachFrameUrls(uploads);
}

router.get("/trips/:tripId/uploads", async (req, res) => {
  const trip = await prisma.trip.findFirst({ where: { id: req.params.tripId, userId: req.user.id } });
  if (!trip) return res.status(404).json({ error: "Trip not found." });

  const status = req.query.status;
  const uploads = await prisma.upload.findMany({
    where: { tripId: trip.id, status: status || undefined },
    select: {
      id: true,
      tripId: true,
      eventId: true,
      zoneId: true,
      guestSessionId: true,
      uploaderAnonId: true,
      uploaderFingerprint: true,
      caption: true,
      fileUrl: true,
      filePublicId: true,
      fileType: true,
      status: true,
      latitude: true,
      longitude: true,
      approximateLatitude: true,
      approximateLongitude: true,
      locationName: true,
      region: true,
      locationVisibility: true,
      moderationStatus: true,
      createdAt: true,
      approvedAt: true,
      rejectedAt: true
    },
    orderBy: { createdAt: "desc" }
  });
  const hydrated = await hydrateUploads(uploads);
  res.json({ uploads: hydrated });
});

router.patch("/uploads/:uploadId/approve", async (req, res) => {
  const upload = await manageableUpload(req, req.params.uploadId);
  if (!upload) return res.status(404).json({ error: "Upload not found." });

  const updated = await prisma.upload.update({
    where: { id: upload.id },
    data: { status: "approved", approvedAt: new Date(), rejectedAt: null },
    select: {
      id: true,
      tripId: true,
      eventId: true,
      zoneId: true,
      guestSessionId: true,
      uploaderAnonId: true,
      uploaderFingerprint: true,
      caption: true,
      fileUrl: true,
      filePublicId: true,
      fileType: true,
      status: true,
      latitude: true,
      longitude: true,
      approximateLatitude: true,
      approximateLongitude: true,
      locationName: true,
      region: true,
      locationVisibility: true,
      moderationStatus: true,
      createdAt: true,
      approvedAt: true,
      rejectedAt: true
    }
  });
  const hydrated = (await hydrateUploads([updated]))[0];
  res.json({ upload: hydrated });
});

router.patch("/uploads/:uploadId/reject", async (req, res) => {
  const upload = await manageableUpload(req, req.params.uploadId);
  if (!upload) return res.status(404).json({ error: "Upload not found." });

  const updated = await prisma.upload.update({
    where: { id: upload.id },
    data: { status: "rejected", rejectedAt: new Date(), approvedAt: null },
    select: {
      id: true,
      tripId: true,
      eventId: true,
      zoneId: true,
      guestSessionId: true,
      uploaderAnonId: true,
      uploaderFingerprint: true,
      caption: true,
      fileUrl: true,
      filePublicId: true,
      fileType: true,
      status: true,
      latitude: true,
      longitude: true,
      approximateLatitude: true,
      approximateLongitude: true,
      locationName: true,
      region: true,
      locationVisibility: true,
      moderationStatus: true,
      createdAt: true,
      approvedAt: true,
      rejectedAt: true
    }
  });
  const hydrated = (await hydrateUploads([updated]))[0];
  res.json({ upload: hydrated });
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
      select: {
        id: true,
        tripId: true,
        eventId: true,
        guestSessionId: true,
        uploaderAnonId: true,
        uploaderFingerprint: true,
        caption: true,
        fileUrl: true,
        filePublicId: true,
        fileType: true,
        status: true,
        locationName: true,
        moderationStatus: true,
        createdAt: true,
        approvedAt: true,
        rejectedAt: true,
        trip: true
      }
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

    const hydrated = (await hydrateUploads([updated]))[0];
    res.json({ upload: hydrated });
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

// Apply or remove a skin on an upload (only owner or admin). Registered users only.
router.patch("/uploads/:uploadId/skin", async (req, res) => {
  const { skinId } = req.body || {};
  // only authenticated users reach here via requireAuth in app.js
  if (!req.user) return res.status(403).json({ error: "Authentication required." });

  const upload = await manageableUpload(req, req.params.uploadId);
  if (!upload) return res.status(404).json({ error: "Upload not found." });

  // Guests not allowed to apply skins
  if (req.user.role === "guest") return res.status(403).json({ error: "Guests cannot apply skins." });

  // Validate skin exists (optional)
  if (skinId) {
    const skin = await prisma.purchaseItem.findUnique({ where: { id: skinId } });
    if (!skin || skin.type !== "image_skin") return res.status(400).json({ error: "Invalid skin." });

    // Check user unlock, purchase ownership, or included basic skin (platform admin bypass)
    const unlocked = await userOwnsSkin(req.user.id, skinId);
    if (!unlocked && !["admin", "platform_admin"].includes(req.user.role)) {
      return res.status(403).json({ error: "Skin not unlocked. Purchase required." });
    }
  }

  try {
    const updated = await prisma.upload.update({
      where: { id: upload.id },
      data: { skinId: skinId || null },
      select: {
        id: true,
        tripId: true,
        eventId: true,
        zoneId: true,
        guestSessionId: true,
        uploaderAnonId: true,
        uploaderFingerprint: true,
        caption: true,
        fileUrl: true,
        filePublicId: true,
        fileType: true,
        status: true,
        latitude: true,
        longitude: true,
        approximateLatitude: true,
        approximateLongitude: true,
        locationName: true,
        region: true,
        locationVisibility: true,
        moderationStatus: true,
        createdAt: true,
        approvedAt: true,
        rejectedAt: true
      }
    });
    const hydrated = (await hydrateUploads([updated]))[0];
    res.json({ upload: hydrated });
  } catch (error) {
    console.error("Failed to update upload skin", error);
    res.status(500).json({ error: "Failed to update upload skin. Database schema may be out of date." });
  }
});

// Assign or update location for a photo (alias route: /api/photos/:id/location)
router.patch("/photos/:id/location", async (req, res, next) => {
  try {
    const schema = z.object({
      locationId: z.string().optional(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      name: z.string().optional(),
      address: z.string().optional()
    });
    const data = schema.parse(req.body || {});
    const upload = await manageableUpload(req, req.params.id);
    if (!upload) return res.status(404).json({ error: "Upload not found." });

    // Validate coordinates
    if ((data.latitude !== undefined && (data.latitude < -90 || data.latitude > 90)) || (data.longitude !== undefined && (data.longitude < -180 || data.longitude > 180))) {
      return res.status(400).json({ error: "Invalid coordinates." });
    }

    let locationIdToSet = data.locationId || null;
    if (!locationIdToSet && (data.latitude !== undefined || data.longitude !== undefined)) {
      // Create a lightweight location record
      const created = await prisma.location.create({ data: {
        name: data.name || (upload.locationName || "Saved location"),
        address: data.address || null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        userId: req.user?.id || null
      }});
      locationIdToSet = created.id;
    }

    const updateData = {};
    if (locationIdToSet) updateData.locationId = locationIdToSet;
    if (data.latitude !== undefined) updateData.latitude = data.latitude;
    if (data.longitude !== undefined) updateData.longitude = data.longitude;

    const updated = await prisma.upload.update({ where: { id: upload.id }, data: updateData });
    const hydrated = (await hydrateUploads([updated]))[0];
    res.json({ upload: hydrated });
  } catch (error) {
    next(error);
  }
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
