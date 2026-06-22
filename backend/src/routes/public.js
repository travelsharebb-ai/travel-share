import bcrypt from "bcryptjs";
import multer from "multer";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma.js";
import { uploadLimiter } from "../middleware/rateLimits.js";
import attachPlatformCache from "../middleware/platformCache.js";
import * as publicController from "../controllers/publicController.js";
import crypto from "node:crypto";
import fs from "node:fs";

const router = Router();
const maxMb = Number(process.env.MAX_UPLOAD_SIZE_MB || 50);
const allowedMime = /^image\//i;
const allowedVideo = /^video\//i;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxMb * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const mt = file.mimetype || "";
    if (allowedMime.test(mt) || allowedVideo.test(mt)) return cb(null, true);
    cb(new Error("Unsupported file type. Only images and videos are allowed."), false);
  }
});

// platformSetting is now provided via services; attach per-request cache middleware
router.use(attachPlatformCache);


function isOpenQr(record) {
  return record?.qrActive !== false && ["open", "approval_required", "trusted", "time_limited", "family_safe"].includes(record?.qrMode || "open");
}

// Public settings endpoint (read-only, uses same DB/env fallback logic as admin)
router.get("/settings", async (_req, res) => {
  return publicController.settings(_req, res, () => {});
});

// `requireCreatorSession` is provided by `sessionService` to enforce creator cookie usage

function guestPayload(session) {
  return {
    token: session.token,
    expiresAt: session.expiresAt,
    expired: session.expiresAt <= new Date()
  };
}

// Upload input validation is imported from `utils/validation.js`

router.get("/appearance", (req, res, next) => publicController.appearance(req, res, next));

router.post("/guest/creator", async (req, res) => {
  return publicController.guestCreator(req, res, () => {});
});

router.get("/guest/creator", publicController.guestCreatorView);

router.delete("/guest/creator", (req, res, next) => publicController.guestCreatorDelete(req, res, next));

router.post("/guest/trips", async (req, res, next) => {
  return publicController.guestCreateTrip(req, res, next);
});

router.get("/guest/trips/:tripId", (req, res, next) => publicController.guestGetTrip(req, res, next));

router.post("/guest/trips/:tripId/share-links", (req, res, next) => publicController.guestCreateTripShareLink(req, res, next));

router.post("/guest/events/:eventId/share-links", (req, res, next) => publicController.guestCreateEventShareLink(req, res, next));

router.post("/guest/events", (req, res, next) => publicController.guestCreateEvent(req, res, next));

router.delete("/guest/trips/:tripId", (req, res, next) => publicController.guestDeleteTrip(req, res, next));

router.delete("/guest/events/:eventId", (req, res, next) => publicController.guestDeleteEvent(req, res, next));

router.get("/qr/:qrToken", publicController.qrGet);

router.post("/qr/:qrToken/uploads", uploadLimiter, upload.single("file"), publicController.handleQrUpload);

router.get("/events", async (_req, res) => {
  const events = await prisma.event.findMany({
    where: { visibility: "public", status: { in: ["live", "ended"] } },
    include: { _count: { select: { uploads: true, zones: true } } },
    orderBy: { startDate: "asc" },
    take: 50
  });
  res.json({ events });
});

router.get("/store-preview", async (_req, res) => {
  const items = await prisma.purchaseItem.findMany({
    where: { active: true },
    orderBy: [{ type: "asc" }, { updatedAt: "desc" }],
    take: 24
  });
  res.json({ items });
});

router.get("/event/:qrToken", publicController.eventGet);

router.post("/event/:qrToken/uploads", uploadLimiter, upload.single("file"), publicController.handleEventUpload);

router.get("/zone/:qrToken", publicController.zoneGet);

router.post("/zone/:qrToken/uploads", uploadLimiter, upload.single("file"), publicController.handleZoneUpload);

router.post("/share/:token/unlock", async (req, res, next) => {
  try {
    const schema = z.object({ pin: z.string().optional().nullable() });
    const data = schema.parse(req.body);
    let link = null;
    try {
      link = await prisma.shareLink.findUnique({
        where: { token: req.params.token },
        include: {
          trip: { include: { uploads: true, user: { select: { name: true } } } },
          event: { include: { uploads: true } }
        }
      });
    } catch (err) {
      console.warn('shareLink.findUnique unsupported or failed:', err && err.message ? err.message : err);
      return res.status(501).json({ error: 'Share link feature unavailable.' });
    }

    if (!link || !link.active) return res.status(404).json({ error: "Shared album not found." });
    if (link.pinHash) {
      const valid = data.pin && await bcrypt.compare(data.pin, link.pinHash);
      if (!valid) return res.status(401).json({ error: "PIN required." });
    }

    if (link.trip) {
      const uploadsBase = link.trip.uploads.map((u) => ({ id: u.id, fileUrl: u.fileUrl }));
      const uploads = await import("../utils/skins.js").then((m) => m.attachFrameUrls(uploadsBase));
      return res.json({ trip: { title: link.trip.title, destination: link.trip.destination, touristName: link.trip.user?.name || "Guest host", uploads } });
    }
    if (link.event) {
      const uploadsBase = link.event.uploads.map((u) => ({ id: u.id, fileUrl: u.fileUrl }));
      const uploads = await import("../utils/skins.js").then((m) => m.attachFrameUrls(uploadsBase));
      return res.json({ event: { title: link.event.title, location: link.event.location, uploads } });
    }
  } catch (error) {
    next(error);
  }
});

router.get("/ads/current", async (req, res) => {
  const now = new Date();
  const placement = req.query.placement;
  const ads = await prisma.internalAd.findMany({
    where: {
      active: true,
      placement: placement ? { in: ["global", placement] } : undefined,
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

// Global upload error handler for multer
router.use((err, req, res, next) => {
  if (err && err.name === 'MulterError') {
    return res.status(400).json({ success: false, error: err.message });
  }
  next(err);
});

export default router;
