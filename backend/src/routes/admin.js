import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import { prisma } from "../utils/prisma.js";
import { secureToken } from "../utils/tokens.js";
import { uploadMedia } from "../utils/storage.js";
import orchestrator from "../services/uploadOrchestrator.js";
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
  let setting = null;
  try {
    setting = await prisma.platformSetting.findUnique({ where: { key } });
  } catch (err) {
    console.warn('platformSetting.findUnique failed', err?.message || err);
    setting = null;
  }
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
    // Select upload fields explicitly to avoid referencing optional columns
    // that may not yet exist in older databases (eg. skinId).
    const uploadSelect = {
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
      downloadPurchaseItemId: true
    };

    const [users, trips, events, uploads, settings, ads, storeItems, purchases, guests] = await Promise.all([
      prisma.user.findMany({ include: { activeStoreItem: true } }),
      prisma.trip.findMany({ include: { chapters: true, shareLinks: true } }),
      prisma.event.findMany({ include: { maps: true, zones: true } }),
      prisma.upload.findMany({ select: uploadSelect }),
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
  const guestDeletionDays = Number(await settingValue("guestDeletionDays", process.env.GUEST_DELETION_DAYS || 14));
  const maxUploadSizeMb = Number(await settingValue("maxUploadSizeMb", process.env.MAX_UPLOAD_SIZE_MB || 50));
  const defaultPrivacy = await settingValue("defaultPrivacy", process.env.DEFAULT_LOCATION_VISIBILITY || "approximate");
  const moderationProvider = await settingValue("moderationProvider", process.env.MODERATION_PROVIDER || "disabled");
  const mapProvider = await settingValue("mapProvider", "mapbox");
  const mapboxToken = await settingValue("mapboxToken", process.env.MAPBOX_TOKEN || "");
  const allowedMapboxStyles = await settingValue("allowedMapboxStyles", process.env.ALLOWED_MAPBOX_STYLES || "");
  const paymentProvider = await settingValue("paymentProvider", process.env.PAYMENT_PROVIDER || "planned_stripe");
  const backgroundVideoUrl = await settingValue("backgroundVideoUrl", process.env.BACKGROUND_VIDEO_URL || "/videos/come-to-barbados.mp4");

  res.json({
    settings: {
      guestAccessDays,
      guestDeletionDays,
      maxUploadSizeMb,
      defaultPrivacy,
      moderationProvider,
      mapProvider,
      mapboxToken,
      allowedMapboxStyles,
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
      "mapboxToken",
      "allowedMapboxStyles",
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
    const guestDeletionDays = Number(await settingValue("guestDeletionDays", process.env.GUEST_DELETION_DAYS || 14));
    const maxUploadSizeMb = Number(await settingValue("maxUploadSizeMb", process.env.MAX_UPLOAD_SIZE_MB || 50));
    const defaultPrivacy = await settingValue("defaultPrivacy", process.env.DEFAULT_LOCATION_VISIBILITY || "approximate");
    const moderationProvider = await settingValue("moderationProvider", process.env.MODERATION_PROVIDER || "disabled");
    const mapProvider = await settingValue("mapProvider", "mapbox");
    const paymentProvider = await settingValue("paymentProvider", process.env.PAYMENT_PROVIDER || "planned_stripe");
    const backgroundVideoUrl = await settingValue("backgroundVideoUrl", process.env.BACKGROUND_VIDEO_URL || "/videos/come-to-barbados.mp4");

    res.json({
      settings: {
        guestAccessDays,
        guestDeletionDays,
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

// Safely deactivate / anonymize a user while preserving public/approved map data.
// This avoids cascading deletions of trips/uploads by keeping a record while
// dissociating or removing non-approved content. This endpoint is intended
// for platform admins only and will not actually delete the user row to avoid
// Prisma cascade-on-delete removing related trips. Instead we anonymize and
// dissociate where appropriate.
router.post("/users/:userId/safe-delete", async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "User not found." });

    // Trips: if a trip has no approved uploads, delete it (and its uploads).
    // If it has approved uploads, dissociate the trip from the user so map pins remain.
    const trips = await prisma.trip.findMany({ where: { userId } });
    for (const trip of trips) {
      const approvedCount = await prisma.upload.count({ where: { tripId: trip.id, status: "approved" } });
      if (approvedCount === 0) {
        try {
          await prisma.trip.delete({ where: { id: trip.id } });
        } catch (err) {
          console.warn('trip.delete failed', err?.message || err);
        }
      } else {
        try {
          await prisma.trip.update({ where: { id: trip.id }, data: { userId: null } });
        } catch (err) {
          console.warn('trip.update failed', err?.message || err);
        }
      }
    }

    // Events: same policy as trips for organizer-owned events
    const events = await prisma.event.findMany({ where: { organizerId: userId } });
    for (const ev of events) {
      const approvedCount = await prisma.upload.count({ where: { eventId: ev.id, status: "approved" } });
      if (approvedCount === 0) {
        try {
          await prisma.event.delete({ where: { id: ev.id } });
        } catch (err) {
          console.warn('event.delete failed', err?.message || err);
        }
      } else {
        try {
          await prisma.event.update({ where: { id: ev.id }, data: { organizerId: null } });
        } catch (err) {
          console.warn('event.update failed', err?.message || err);
        }
      }
    }

    // Remove non-approved standalone uploads (not associated with an approved trip/event)
    try {
      await prisma.upload.deleteMany({ where: { AND: [{ OR: [{ trip: { userId } }, { event: { organizerId: userId } }] }, { status: { not: "approved" } }] } });
    } catch (err) {
      console.warn('upload.deleteMany failed', err?.message || err);
    }

    // Remove personal purchases and session records to reduce personal data footprint
    try {
      await prisma.userPurchase.deleteMany({ where: { userId } });
    } catch (err) {
      console.warn('userPurchase.deleteMany failed', err?.message || err);
    }
    try {
      await prisma.guestSession.updateMany({ where: { claimedById: userId }, data: { claimedById: null } });
    } catch (err) {
      console.warn('guestSession.updateMany failed', err?.message || err);
    }

    // Anonymize the user record (do not delete to avoid cascading deletes in Prisma schema)
    try {
      await prisma.user.update({ where: { id: userId }, data: {
        name: "Deleted user",
        email: `deleted+${userId}@example.invalid`,
        passwordHash: secureToken(32),
        role: "guest",
        activeStoreItemId: null
      }});
    } catch (err) {
      console.warn('user.update failed', err?.message || err);
    }

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get("/moderation", async (_req, res) => {
  try {
    const uploads = await prisma.upload.findMany({
      where: { status: "reported" },
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
        trip: { select: { title: true, destination: true, user: { select: { name: true, email: true } } } }
      },
      orderBy: { createdAt: "desc" }
    });
    res.json({ uploads });
  } catch (error) {
    // If the database is missing optional columns (eg. skinId) this query
    // may fail with a Prisma P2022 error. Surface a helpful message rather
    // than allowing the process to crash.
    console.error("Moderation listing failed", error);
    res.status(500).json({ error: "Moderation listing failed. Database schema may be out of date." });
  }
});
 

router.patch("/uploads/:uploadId/download-item", async (req, res, next) => {
  try {
    const data = z.object({ itemId: z.string().optional().nullable() }).parse(req.body);
    const upload = await prisma.upload.update({
      where: { id: req.params.uploadId },
      data: { downloadPurchaseItemId: data.itemId },
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
    const result = await orchestrator.executeUploadPipeline({ file: req.file, body: {}, context: { type: 'admin', entityId: null, params: {} }, idempotencyKey: null, fingerprint: null, sessionToken: null });
    res.status(201).json({ media: result.media });
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
