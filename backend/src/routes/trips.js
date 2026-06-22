import QRCode from "qrcode";
import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma.js";
import { secureToken } from "../utils/tokens.js";
import crypto from "node:crypto";

const router = Router();

const tripSchema = z.object({
  title: z.string().min(2).max(120),
  destination: z.string().min(2).max(120),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  qrExpiresAt: z.string().optional().nullable(),
  defaultLocationVisibility: z.enum(["exact", "approximate", "hidden"]).optional()
});

router.get("/", async (req, res) => {
  const trips = await prisma.trip.findMany({
    where: { userId: req.user.id },
    include: { _count: { select: { uploads: true } } },
    orderBy: { createdAt: "desc" }
  });
  res.json({ trips });
});

router.post("/", async (req, res, next) => {
  try {
    const data = tripSchema.parse(req.body);
    const trip = await prisma.trip.create({
      data: {
        userId: req.user.id,
        title: data.title,
        destination: data.destination,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        qrExpiresAt: data.qrExpiresAt ? new Date(data.qrExpiresAt) : null,
        defaultLocationVisibility: data.defaultLocationVisibility || "approximate",
        qrToken: crypto.randomBytes(16).toString("hex")
      }
    });
    res.status(201).json({ trip });
  } catch (error) {
    next(error);
  }
});

router.get("/:tripId/map", async (req, res) => {
  const trip = await prisma.trip.findFirst({
    where: { id: req.params.tripId, userId: req.user.id },
    include: {
      uploads: {
        where: { status: "approved" },
        orderBy: { createdAt: "asc" }
      }
    }
  });
  if (!trip) return res.status(404).json({ error: "Trip not found." });

  // Map uploads into the visible shape then attach frameAssetUrl in batch
  const visibleUploadsBase = trip.uploads.map((upload) => {
    const lat = upload.locationVisibility === "exact" ? upload.latitude : upload.approximateLatitude;
    const lng = upload.locationVisibility === "exact" ? upload.longitude : upload.approximateLongitude;
    return {
      id: upload.id,
      fileUrl: upload.fileUrl,
      fileType: upload.fileType,
      caption: upload.caption,
      locationName: upload.locationName || upload.region || "Travel memory",
      region: upload.region,
      latitude: upload.locationVisibility === "hidden" ? null : lat,
      longitude: upload.locationVisibility === "hidden" ? null : lng,
      createdAt: upload.createdAt,
      locationVisibility: upload.locationVisibility,
      skinId: upload.skinId || null
    };
  });
  const visibleUploads = await import("../utils/skins.js").then((m) => m.attachFrameUrls(visibleUploadsBase));

  const groups = new Map();
  for (const memory of visibleUploads) {
    const key = memory.latitude === null || memory.longitude === null
      ? `hidden:${memory.region || "Hidden"}`
      : `${memory.locationName}:${memory.latitude}:${memory.longitude}`;
    const existing = groups.get(key) || {
      id: key,
      locationName: memory.locationName,
      latitude: memory.latitude,
      longitude: memory.longitude,
      count: 0,
      memories: []
    };
    existing.count += 1;
    existing.memories.push(memory);
    groups.set(key, existing);
  }

  res.json({
    trip: { id: trip.id, title: trip.title, destination: trip.destination },
    pins: Array.from(groups.values()),
    route: visibleUploads.filter((memory) => memory.latitude !== null && memory.longitude !== null),
    heatmap: Array.from(groups.values()).map((pin) => ({ latitude: pin.latitude, longitude: pin.longitude, weight: pin.count, locationName: pin.locationName })),
    replay: visibleUploads
  });
});

router.get("/:tripId", async (req, res) => {
  const trip = await prisma.trip.findFirst({
    where: { id: req.params.tripId, userId: req.user.id },
    include: {
      uploads: { orderBy: { createdAt: "desc" } },
      shareLinks: { orderBy: { createdAt: "desc" } },
      chapters: { orderBy: { createdAt: "desc" } },
      _count: { select: { uploads: true } }
    }
  });
  if (!trip) return res.status(404).json({ error: "Trip not found." });
  // hydrate uploads with frameAssetUrl when present (batch)
  const uploadsBase = trip.uploads.map((u) => ({ ...u, skinId: u.skinId || null }));
  const uploads = await import("../utils/skins.js").then((m) => m.attachFrameUrls(uploadsBase));
  res.json({ trip: { ...trip, uploads } });
});

router.post("/:tripId/chapters", async (req, res, next) => {
  try {
    const schema = z.object({
      title: z.string().min(2).max(120),
      note: z.string().max(800).optional().nullable()
    });
    const data = schema.parse(req.body);
    const trip = await prisma.trip.findFirst({ where: { id: req.params.tripId, userId: req.user.id } });
    if (!trip) return res.status(404).json({ error: "Trip not found." });
    const chapter = await prisma.tripChapter.create({
      data: {
        tripId: trip.id,
        title: data.title,
        note: data.note || null
      }
    });
    res.status(201).json({ chapter });
  } catch (error) {
    next(error);
  }
});

router.get("/:tripId/qr", async (req, res) => {
  const trip = await prisma.trip.findFirst({ where: { id: req.params.tripId, userId: req.user.id } });
  if (!trip) return res.status(404).json({ error: "Trip not found." });

  const scanUrl = `${process.env.FRONTEND_URL}/qr/${trip.qrToken}`;
  const dataUrl = await QRCode.toDataURL(scanUrl, { margin: 1, width: 720 });
  res.json({ scanUrl, dataUrl, trip });
});

router.patch("/:tripId/qr-settings", async (req, res, next) => {
  try {
    const schema = z.object({
      qrActive: z.boolean().optional(),
      qrMode: z.enum(["open", "approval_required", "trusted", "time_limited", "family_safe", "paused", "expired", "revoked"]).optional(),
      qrExpiresAt: z.string().nullable().optional(),
      regenerate: z.boolean().optional()
    });
    const data = schema.parse(req.body);

    const trip = await prisma.trip.findFirst({ where: { id: req.params.tripId, userId: req.user.id } });
    if (!trip) return res.status(404).json({ error: "Trip not found." });

    const updated = await prisma.trip.update({
      where: { id: trip.id },
      data: {
        qrActive: data.qrActive ?? undefined,
        qrMode: data.qrMode ?? undefined,
        qrExpiresAt: data.qrExpiresAt === undefined ? undefined : data.qrExpiresAt ? new Date(data.qrExpiresAt) : null,
        qrToken: data.regenerate ? crypto.randomBytes(16).toString("hex") : undefined
      }
    });

    res.json({ trip: updated });
  } catch (error) {
    next(error);
  }
});

router.post("/:tripId/share-links", async (req, res, next) => {
  try {
    const schema = z.object({ pin: z.string().min(4).max(24).optional().nullable() });
    const data = schema.parse(req.body);
    const trip = await prisma.trip.findFirst({ where: { id: req.params.tripId, userId: req.user.id } });
    if (!trip) return res.status(404).json({ error: "Trip not found." });

    const shareLink = await prisma.shareLink.create({
      data: {
        tripId: trip.id,
        token: crypto.randomBytes(16).toString("hex"),
        pinHash: data.pin ? await bcrypt.hash(data.pin, 12) : null
      }
    });

    res.status(201).json({ shareLink, url: `${process.env.FRONTEND_URL}/share/${shareLink.token}` });
  } catch (error) {
    next(error);
  }
});

export default router;
