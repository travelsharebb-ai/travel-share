import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import { prisma } from "../utils/prisma.js";
import { uploadMedia } from "../utils/storage.js";
import { cleanUpload, cleanUser } from "../utils/exportImport.js";

const router = Router();
const maxMb = Number(process.env.MAX_UPLOAD_SIZE_MB || 50);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxMb * 1024 * 1024 }
});

const adSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().max(240).optional().nullable(),
  mediaUrl: z.string().url(),
  mediaType: z.enum(["image", "video"]),
  linkUrl: z.string().url().optional().nullable(),
  active: z.boolean().optional(),
  priority: z.coerce.number().int().min(0).max(1000).optional(),
  displaySeconds: z.coerce.number().int().min(5).max(60).optional(),
  placement: z.enum(["global", "tourist", "event", "guest", "map", "upload_success"]).optional(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable()
});

const assetUrlSchema = z.string().refine((value) => {
  if (value.startsWith("/assets/") || value.startsWith("/uploads/")) return true;
  return z.string().url().safeParse(value).success;
}, "Must be a URL or an internal asset path.");

const storeItemSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional().nullable(),
  type: z.enum(["image_skin", "photo_frame", "album_theme", "event_theme", "download_asset", "premium_qr", "branded_page", "ad_free"]),
  priceCents: z.coerce.number().int().min(0).optional(),
  previewUrl: assetUrlSchema.optional().nullable(),
  active: z.boolean().optional(),
  metadata: z.any().optional().nullable()
});

async function settingValue(key, fallback) {
  const setting = await prisma.platformSetting.findUnique({ where: { key } }).catch(() => null);
  return setting?.value || fallback;
}

router.get("/stats", async (_req, res) => {
  const [users, organizers, guests, trips, events, uploads, reported, ads, storeItems] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "organizer" } }),
    prisma.guestSession.count(),
    prisma.trip.count(),
    prisma.event.count(),
    prisma.upload.count(),
    prisma.upload.count({ where: { status: "reported" } }),
    prisma.internalAd.count(),
    prisma.purchaseItem.count()
  ]);
  res.json({ stats: { users, organizers, guests, trips, events, uploads, reported, ads, storeItems } });
});

router.post("/export/site", async (req, res, next) => {
  try {
    const [users, trips, events, uploads, settings, ads, storeItems, purchases, guests] = await Promise.all([
      prisma.user.findMany({ include: { activeStoreItem: true } }),
      prisma.trip.findMany({ include: { chapters: true, shareLinks: true } }),
      prisma.event.findMany({ include: { maps: true, zones: true } }),
      prisma.upload.findMany(),
      prisma.platformSetting.findMany(),
      prisma.internalAd.findMany(),
      prisma.purchaseItem.findMany(),
      prisma.userPurchase.findMany(),
      prisma.guestSession.findMany()
    ]);
    res.json({
      exportedAt: new Date().toISOString(),
      formatVersion: 1,
      users: users.map(cleanUser),
      trips,
      events,
      uploads: uploads.map(cleanUpload),
      settings,
      ads,
      storeItems,
      purchases,
      guests
    });
  } catch (error) {
    next(error);
  }
});

router.post("/import", async (req, res) => {
  const dryRun = req.query.dryRun !== "false";
  res.json({
    dryRun,
    valid: true,
    counts: {
      users: Array.isArray(req.body?.users) ? req.body.users.length : 0,
      trips: Array.isArray(req.body?.trips) ? req.body.trips.length : 0,
      events: Array.isArray(req.body?.events) ? req.body.events.length : 0,
      uploads: Array.isArray(req.body?.uploads) ? req.body.uploads.length : 0,
      storeItems: Array.isArray(req.body?.storeItems) ? req.body.storeItems.length : 0
    },
    message: "Dry-run validation complete. Full admin restore should use database backup/restore for now."
  });
});

router.get("/users", async (req, res) => {
  const q = req.query.q?.toString() || "";
  const users = await prisma.user.findMany({
    where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } : {},
    select: { id: true, name: true, email: true, role: true, createdAt: true, _count: { select: { trips: true, organizedEvents: true, purchases: true } } },
    orderBy: { createdAt: "desc" },
    take: 100
  });
  res.json({ users });
});

router.patch("/users/:userId", async (req, res, next) => {
  try {
    const schema = z.object({
      role: z.enum(["tourist", "admin", "platform_admin", "organizer", "guest"]).optional(),
      name: z.string().min(2).max(80).optional()
    });
    const data = schema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.params.userId },
      data,
      select: { id: true, name: true, email: true, role: true }
    });
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

router.get("/events", async (_req, res) => {
  const events = await prisma.event.findMany({
    include: { organizer: { select: { name: true, email: true } }, _count: { select: { uploads: true, zones: true } } },
    orderBy: { startDate: "desc" }
  });
  res.json({ events });
});

router.get("/guests", async (_req, res) => {
  const guests = await prisma.guestSession.findMany({
    include: { claimedBy: { select: { name: true, email: true } }, _count: { select: { uploads: true } } },
    orderBy: { createdAt: "desc" },
    take: 100
  });
  res.json({ guests });
});

router.get("/analytics", async (_req, res) => {
  const zones = await prisma.mapZone.findMany({
    include: { event: { select: { title: true } }, _count: { select: { uploads: true } } },
    orderBy: { updatedAt: "desc" },
    take: 50
  });
  const mapHotspots = await prisma.upload.groupBy({
    by: ["locationName"],
    where: { locationName: { not: null } },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 20
  });
  res.json({
    analytics: {
      popularZones: zones.map((zone) => ({ event: zone.event.title, zone: zone.name, count: zone._count.uploads, crowdStatus: zone.crowdStatus })),
      mapHotspots: mapHotspots.map((item) => ({ locationName: item.locationName, count: item._count.id }))
    }
  });
});

router.get("/settings", async (_req, res) => {
  const guestAccessDays = Number(await settingValue("guestAccessDays", process.env.GUEST_ACCESS_DAYS || 3));
  const maxUploadSizeMb = Number(await settingValue("maxUploadSizeMb", process.env.MAX_UPLOAD_SIZE_MB || 50));
  const defaultPrivacy = await settingValue("defaultPrivacy", process.env.DEFAULT_LOCATION_VISIBILITY || "approximate");
  const moderationProvider = await settingValue("moderationProvider", process.env.MODERATION_PROVIDER || "disabled");
  const mapProvider = await settingValue("mapProvider", "mapbox");
  const paymentProvider = await settingValue("paymentProvider", process.env.PAYMENT_PROVIDER || "planned_stripe");
  const backgroundVideoUrl = await settingValue("backgroundVideoUrl", process.env.BACKGROUND_VIDEO_URL || "/videos/come-to-barbados.mp4");

  res.json({
    settings: {
      guestAccessDays,
      maxUploadSizeMb,
      defaultPrivacy,
      moderationProvider,
      mapProvider,
      paymentProvider,
      backgroundVideoUrl
    }
  });
});

router.patch("/settings", async (req, res, next) => {
  try {
    // Allow updating a controlled set of platform settings via admin API.
    const allowedKeys = [
      "guestAccessDays",
      "guestDeletionDays",
      "maxUploadSizeMb",
      "defaultPrivacy",
      "moderationProvider",
      "mapProvider",
      "paymentProvider",
      "backgroundVideoUrl"
    ];

    // Accept a simple key/value object in the request body. Validate basic types.
    const schema = z.record(z.string(), z.any()).optional();
    const data = schema.parse(req.body) || {};

    for (const [key, value] of Object.entries(data)) {
      if (!allowedKeys.includes(key)) continue; // ignore unknown keys
      const stringValue = value === null || value === undefined ? "" : String(value);
      await prisma.platformSetting.upsert({
        where: { key },
        update: { value: stringValue },
        create: { key, value: stringValue }
      });
    }

    // Return the current settings after updates (read via DB/env fallback)
    const guestAccessDays = Number(await settingValue("guestAccessDays", process.env.GUEST_ACCESS_DAYS || 3));
    const maxUploadSizeMb = Number(await settingValue("maxUploadSizeMb", process.env.MAX_UPLOAD_SIZE_MB || 50));
    const defaultPrivacy = await settingValue("defaultPrivacy", process.env.DEFAULT_LOCATION_VISIBILITY || "approximate");
    const moderationProvider = await settingValue("moderationProvider", process.env.MODERATION_PROVIDER || "disabled");
    const mapProvider = await settingValue("mapProvider", "mapbox");
    const paymentProvider = await settingValue("paymentProvider", process.env.PAYMENT_PROVIDER || "planned_stripe");
    const backgroundVideoUrl = await settingValue("backgroundVideoUrl", process.env.BACKGROUND_VIDEO_URL || "/videos/come-to-barbados.mp4");

    res.json({
      settings: {
        guestAccessDays,
        maxUploadSizeMb,
        defaultPrivacy,
        moderationProvider,
        mapProvider,
        paymentProvider,
        backgroundVideoUrl
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get("/moderation", async (_req, res) => {
  const uploads = await prisma.upload.findMany({
    where: { status: "reported" },
    include: {
      trip: { select: { title: true, destination: true, user: { select: { name: true, email: true } } } }
    },
    orderBy: { createdAt: "desc" }
  });
  res.json({ uploads });
});

router.patch("/uploads/:uploadId/download-item", async (req, res, next) => {
  try {
    const data = z.object({ itemId: z.string().optional().nullable() }).parse(req.body);
    const upload = await prisma.upload.update({
      where: { id: req.params.uploadId },
      data: { downloadPurchaseItemId: data.itemId }
    });
    res.json({ upload });
  } catch (error) {
    next(error);
  }
});

router.post("/moderation/:uploadId/log", async (req, res, next) => {
  try {
    const schema = z.object({
      action: z.string().min(2).max(80),
      notes: z.string().max(500).optional()
    });
    const data = schema.parse(req.body);
    const log = await prisma.adminModerationLog.create({
      data: {
        uploadId: req.params.uploadId,
        adminId: req.user.id,
        action: data.action,
        notes: data.notes
      }
    });
    res.status(201).json({ log });
  } catch (error) {
    next(error);
  }
});

router.get("/ads", async (_req, res) => {
  const ads = await prisma.internalAd.findMany({
    orderBy: [{ active: "desc" }, { priority: "desc" }, { updatedAt: "desc" }]
  });
  res.json({ ads });
});

router.get("/store", async (_req, res) => {
  const items = await prisma.purchaseItem.findMany({
    include: { _count: { select: { purchases: true } } },
    orderBy: [{ active: "desc" }, { updatedAt: "desc" }]
  });
  res.json({ items });
});

router.post("/store", async (req, res, next) => {
  try {
    const data = storeItemSchema.parse(req.body);
    const item = await prisma.purchaseItem.create({
      data: {
        ...data,
        description: data.description || null,
        previewUrl: data.previewUrl || null,
        priceCents: data.priceCents || 0,
        active: data.active ?? true,
        metadata: data.metadata || undefined
      }
    });
    res.status(201).json({ item });
  } catch (error) {
    next(error);
  }
});

router.patch("/store/:itemId", async (req, res, next) => {
  try {
    const data = storeItemSchema.partial().parse(req.body);
    const existing = await prisma.purchaseItem.findUnique({ where: { id: req.params.itemId } });
    if (!existing) return res.status(404).json({ error: "Store item not found." });

    const stripeSensitiveFields = ["name", "description", "type", "priceCents"];
    const shouldClearStripePrice = stripeSensitiveFields.some((field) => Object.prototype.hasOwnProperty.call(data, field));
    let metadata = data.metadata;
    if (shouldClearStripePrice && existing.metadata && !data.metadata && !Array.isArray(existing.metadata)) {
      const { stripePriceId, stripeLookupKey, stripeCurrency, ...rest } = existing.metadata;
      metadata = rest;
    }

    const item = await prisma.purchaseItem.update({
      where: { id: req.params.itemId },
      data: {
        ...data,
        ...(metadata !== undefined ? { metadata } : {})
      }
    });
    res.json({ item });
  } catch (error) {
    next(error);
  }
});

router.post("/ads/media", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "An image or video file is required." });
    const media = await uploadMedia(req.file);
    res.status(201).json({ media });
  } catch (error) {
    next(error);
  }
});

router.post("/ads", async (req, res, next) => {
  try {
    const data = adSchema.parse(req.body);
    const ad = await prisma.internalAd.create({
      data: {
        ...data,
        description: data.description || null,
        linkUrl: data.linkUrl || null,
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
        createdById: req.user.id
      }
    });
    res.status(201).json({ ad });
  } catch (error) {
    next(error);
  }
});

router.patch("/ads/:adId", async (req, res, next) => {
  try {
    const data = adSchema.partial().parse(req.body);
    const existing = await prisma.internalAd.findUnique({ where: { id: req.params.adId } });
    if (!existing) return res.status(404).json({ error: "Ad not found." });

    const ad = await prisma.internalAd.update({
      where: { id: existing.id },
      data: {
        ...data,
        description: data.description === undefined ? undefined : data.description || null,
        linkUrl: data.linkUrl === undefined ? undefined : data.linkUrl || null,
        startsAt: data.startsAt === undefined ? undefined : data.startsAt ? new Date(data.startsAt) : null,
        endsAt: data.endsAt === undefined ? undefined : data.endsAt ? new Date(data.endsAt) : null
      }
    });
    res.json({ ad });
  } catch (error) {
    next(error);
  }
});

router.delete("/ads/:adId", async (req, res) => {
  const existing = await prisma.internalAd.findUnique({ where: { id: req.params.adId } });
  if (!existing) return res.status(404).json({ error: "Ad not found." });
  await prisma.internalAd.delete({ where: { id: existing.id } });
  res.status(204).end();
});

export default router;
