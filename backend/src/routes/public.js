import bcrypt from "bcryptjs";
import multer from "multer";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma.js";
import { anonId, fingerprintFromRequest, getOrSetUploaderSession } from "../utils/tokens.js";
import { uploadMedia } from "../utils/cloudinary.js";
import { uploadLimiter } from "../middleware/rateLimits.js";
import { moderateMedia } from "../utils/moderation.js";
import { notifyNewUpload } from "../utils/email.js";

const router = Router();
const maxMb = Number(process.env.MAX_UPLOAD_SIZE_MB || 50);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxMb * 1024 * 1024 }
});

router.get("/qr/:qrToken", async (req, res) => {
  getOrSetUploaderSession(req, res);
  const trip = await prisma.trip.findUnique({
    where: { qrToken: req.params.qrToken },
    include: { user: { select: { name: true } } }
  });

  if (!trip || !trip.qrActive || trip.qrMode !== "open") {
    return res.status(404).json({ error: "This QR link is not accepting uploads right now." });
  }

  if (trip.qrExpiresAt && trip.qrExpiresAt < new Date()) {
    return res.status(410).json({ error: "This QR link has expired." });
  }

  res.json({
    trip: {
      id: trip.id,
      title: trip.title,
      destination: trip.destination,
      touristFirstName: trip.user.name.split(" ")[0],
      supportEmail: process.env.SUPPORT_EMAIL || "support@example.com"
    }
  });
});

router.post("/qr/:qrToken/uploads", uploadLimiter, upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "A photo or video is required." });

    getOrSetUploaderSession(req, res);
    const trip = await prisma.trip.findUnique({
      where: { qrToken: req.params.qrToken },
      include: { user: { select: { id: true, name: true, email: true } } }
    });
    if (!trip || !trip.qrActive || trip.qrMode !== "open") {
      return res.status(404).json({ error: "This QR link is not accepting uploads right now." });
    }
    if (trip.qrExpiresAt && trip.qrExpiresAt < new Date()) {
      return res.status(410).json({ error: "This QR link has expired." });
    }

    const uploaderFingerprint = fingerprintFromRequest(req);
    const blocked = await prisma.blockedUploader.findUnique({
      where: { tripId_uploaderFingerprint: { tripId: trip.id, uploaderFingerprint } }
    });
    if (blocked) return res.status(403).json({ error: "Uploads are blocked for this QR link." });

    const media = await uploadMedia(req.file);
    let moderation;
    try {
      moderation = await moderateMedia(media);
    } catch (error) {
      moderation = {
        provider: process.env.MODERATION_PROVIDER || "disabled",
        status: "error",
        aiFlagged: true,
        labels: { error: error.message }
      };
    }

    const saved = await prisma.upload.create({
      data: {
        tripId: trip.id,
        uploaderAnonId: anonId(),
        uploaderFingerprint,
        ...media,
        aiFlagged: moderation.aiFlagged,
        moderationProvider: moderation.provider,
        moderationStatus: moderation.status,
        moderationLabels: moderation.labels,
        status: "pending"
      }
    });

    notifyNewUpload({ trip, upload: saved }).catch((error) => {
      console.error("New upload notification failed", error);
    });

    res.status(201).json({
      upload: {
        id: saved.id,
        status: saved.status,
        uploaderAnonId: saved.uploaderAnonId
      },
      message: "Upload received. It is private until the tourist approves it."
    });
  } catch (error) {
    next(error);
  }
});

router.post("/share/:token/unlock", async (req, res, next) => {
  try {
    const schema = z.object({ pin: z.string().optional().nullable() });
    const data = schema.parse(req.body);
    const link = await prisma.shareLink.findUnique({
      where: { token: req.params.token },
      include: {
        trip: {
          include: {
            uploads: { where: { status: "approved" }, orderBy: { approvedAt: "desc" } },
            user: { select: { name: true } }
          }
        }
      }
    });

    if (!link || !link.active) return res.status(404).json({ error: "Shared album not found." });
    if (link.pinHash) {
      const valid = data.pin && await bcrypt.compare(data.pin, link.pinHash);
      if (!valid) return res.status(401).json({ error: "PIN required." });
    }

    res.json({
      trip: {
        title: link.trip.title,
        destination: link.trip.destination,
        touristName: link.trip.user.name,
        uploads: link.trip.uploads.map(({ id, fileUrl, fileType, approvedAt }) => ({ id, fileUrl, fileType, approvedAt }))
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get("/ads/current", async (_req, res) => {
  const now = new Date();
  const ads = await prisma.internalAd.findMany({
    where: {
      active: true,
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }]
    },
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
    take: 10
  });

  if (!ads.length) return res.json({ ad: null });

  const totalWeight = ads.reduce((sum, ad) => sum + Math.max(1, ad.priority + 1), 0);
  let pick = Math.random() * totalWeight;
  const selected = ads.find((ad) => {
    pick -= Math.max(1, ad.priority + 1);
    return pick <= 0;
  }) || ads[0];

  res.json({
    ad: {
      id: selected.id,
      title: selected.title,
      description: selected.description,
      mediaUrl: selected.mediaUrl,
      mediaType: selected.mediaType,
      linkUrl: selected.linkUrl,
      displaySeconds: selected.displaySeconds
    }
  });
});

export default router;
