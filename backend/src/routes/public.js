import bcrypt from "bcryptjs";
import multer from "multer";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma.js";
import { anonId, fingerprintFromRequest, getOrSetUploaderSession, readCookie, secureToken, setGuestSessionCookie } from "../utils/tokens.js";
import { uploadMedia } from "../utils/storage.js";
import { uploadLimiter } from "../middleware/rateLimits.js";
import { moderateMedia } from "../utils/moderation.js";
import { notifyNewUpload } from "../utils/email.js";

const router = Router();
const maxMb = Number(process.env.MAX_UPLOAD_SIZE_MB || 50);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxMb * 1024 * 1024 }
});

async function platformSetting(key, fallback) {
  const setting = await prisma.platformSetting.findUnique({ where: { key } }).catch(() => null);
  return setting?.value || fallback;
}

function isOpenQr(record) {
  return record?.qrActive !== false && ["open", "approval_required", "trusted", "time_limited", "family_safe"].includes(record?.qrMode || "open");
}

function parseOptionalFloat(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function locationData(body = {}) {
  const latitude = parseOptionalFloat(body.latitude);
  const longitude = parseOptionalFloat(body.longitude);
  const visibility = ["exact", "approximate", "hidden"].includes(body.locationVisibility) ? body.locationVisibility : "approximate";
  return {
    caption: body.caption?.slice?.(0, 240) || null,
    latitude: visibility === "hidden" ? null : latitude,
    longitude: visibility === "hidden" ? null : longitude,
    approximateLatitude: latitude === null ? null : Math.round(latitude * 100) / 100,
    approximateLongitude: longitude === null ? null : Math.round(longitude * 100) / 100,
    locationName: body.locationName?.slice?.(0, 120) || null,
    region: body.region?.slice?.(0, 120) || null,
    locationVisibility: visibility
  };
}

async function getOrCreateGuestSession(req, res, scopeType, scopeId) {
  const existingToken = readCookie(req, "ts_guest");
  const existing = existingToken ? await prisma.guestSession.findUnique({ where: { token: existingToken } }) : null;
  if (existing && existing.scopeType === scopeType && existing.scopeId === scopeId && existing.expiresAt > new Date()) {
    setGuestSessionCookie(res, existing.token);
    return existing;
  }

  const session = await prisma.guestSession.create({
    data: {
      token: secureToken(24),
      deviceFingerprint: fingerprintFromRequest(req),
      scopeType,
      scopeId,
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    }
  });
  setGuestSessionCookie(res, session.token);
  return session;
}

async function getOrCreateCreatorSession(req, res) {
  const existingToken = readCookie(req, "ts_guest");
  const existing = existingToken ? await prisma.guestSession.findUnique({ where: { token: existingToken } }) : null;
  if (existing && existing.scopeType === "creator" && existing.expiresAt > new Date() && !existing.claimedById) {
    setGuestSessionCookie(res, existing.token);
    return existing;
  }

  const token = secureToken(24);
  const session = await prisma.guestSession.create({
    data: {
      token,
      deviceFingerprint: fingerprintFromRequest(req),
      scopeType: "creator",
      scopeId: token,
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    }
  });
  setGuestSessionCookie(res, session.token);
  return session;
}

async function requireCreatorSession(req, res) {
  const token = readCookie(req, "ts_guest") || req.get("x-guest-token");
  const session = token ? await prisma.guestSession.findUnique({ where: { token } }) : null;
  if (!session || session.scopeType !== "creator" || session.claimedById) {
    res.status(401).json({ error: "Guest creator session not found. Start a guest space again." });
    return null;
  }
  if (session.expiresAt <= new Date()) {
    res.status(403).json({ error: "Guest creator access expired. Create an account to continue." });
    return null;
  }
  setGuestSessionCookie(res, session.token);
  return session;
}

function guestPayload(session) {
  return {
    token: session.token,
    expiresAt: session.expiresAt,
    expired: session.expiresAt <= new Date()
  };
}

const guestTripSchema = z.object({
  title: z.string().min(2).max(120),
  destination: z.string().min(2).max(120),
  defaultLocationVisibility: z.enum(["exact", "approximate", "hidden"]).optional()
});

const guestEventSchema = z.object({
  title: z.string().min(2).max(140),
  description: z.string().max(1000).optional().nullable(),
  category: z.string().max(80).optional().nullable(),
  location: z.string().max(160).optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  visibility: z.enum(["public", "private", "unlisted"]).optional(),
  coverImageUrl: z.string().url().optional().nullable()
});

router.get("/appearance", async (_req, res) => {
  res.json({
    appearance: {
      backgroundVideoUrl: await platformSetting("backgroundVideoUrl", process.env.BACKGROUND_VIDEO_URL || "/videos/come-to-barbados.mp4")
    }
  });
});

router.post("/guest/creator", async (req, res) => {
  const guest = await getOrCreateCreatorSession(req, res);
  res.status(201).json({ guest: guestPayload(guest) });
});

router.get("/guest/creator", async (req, res) => {
  const guest = await requireCreatorSession(req, res);
  if (!guest) return;
  const [trips, events] = await Promise.all([
    prisma.trip.findMany({
      where: { guestSessionId: guest.id },
      include: { _count: { select: { uploads: true, shareLinks: true } } },
      orderBy: { createdAt: "desc" }
    }),
    prisma.event.findMany({
      where: { guestSessionId: guest.id },
      include: { _count: { select: { uploads: true, zones: true } } },
      orderBy: { createdAt: "desc" }
    })
  ]);
  res.json({ guest: guestPayload(guest), trips, events });
});

router.delete("/guest/creator", async (req, res) => {
  const token = readCookie(req, "ts_guest") || req.get("x-guest-token");
  if (token) {
    await prisma.guestSession.updateMany({
      where: { token, scopeType: "creator", claimedById: null },
      data: { expiresAt: new Date() }
    });
  }
  res.status(204).end();
});

router.post("/guest/trips", async (req, res, next) => {
  try {
    const guest = await requireCreatorSession(req, res);
    if (!guest) return;
    const data = guestTripSchema.parse(req.body);
    const trip = await prisma.trip.create({
      data: {
        guestSessionId: guest.id,
        title: data.title,
        destination: data.destination,
        defaultLocationVisibility: data.defaultLocationVisibility || "approximate",
        qrToken: secureToken(24),
        qrExpiresAt: guest.expiresAt,
        qrMode: "approval_required"
      }
    });
    const scanUrl = `${process.env.FRONTEND_URL}/qr/${trip.qrToken}`;
    res.status(201).json({ trip, scanUrl, guest: guestPayload(guest) });
  } catch (error) {
    next(error);
  }
});

router.get("/guest/trips/:tripId", async (req, res) => {
  const guest = await requireCreatorSession(req, res);
  if (!guest) return;
  const trip = await prisma.trip.findFirst({
    where: { id: req.params.tripId, guestSessionId: guest.id },
    include: {
      uploads: { orderBy: { createdAt: "desc" } },
      shareLinks: { orderBy: { createdAt: "desc" } },
      _count: { select: { uploads: true } }
    }
  });
  if (!trip) return res.status(404).json({ error: "Guest album not found." });
  const scanUrl = `${process.env.FRONTEND_URL}/qr/${trip.qrToken}`;
  res.json({ trip, scanUrl, guest: guestPayload(guest) });
});

router.post("/guest/trips/:tripId/share-links", async (req, res, next) => {
  try {
    const guest = await requireCreatorSession(req, res);
    if (!guest) return;
    const trip = await prisma.trip.findFirst({ where: { id: req.params.tripId, guestSessionId: guest.id } });
    if (!trip) return res.status(404).json({ error: "Guest album not found." });
    const shareLink = await prisma.shareLink.create({
      data: { tripId: trip.id, token: secureToken(24) }
    });
    res.status(201).json({ shareLink, url: `${process.env.FRONTEND_URL}/share/${shareLink.token}` });
  } catch (error) {
    next(error);
  }
});

router.post("/guest/events/:eventId/share-links", async (req, res, next) => {
  try {
    const guest = await requireCreatorSession(req, res);
    if (!guest) return;
    const event = await prisma.event.findFirst({ where: { id: req.params.eventId, guestSessionId: guest.id } });
    if (!event) return res.status(404).json({ error: "Guest event not found." });
    const shareLink = await prisma.shareLink.create({
      data: { eventId: event.id, token: secureToken(24) }
    });
    res.status(201).json({ shareLink, url: `${process.env.FRONTEND_URL}/share/${shareLink.token}` });
  } catch (error) {
    next(error);
  }
});

router.post("/guest/events", async (req, res, next) => {
  try {
    const guest = await requireCreatorSession(req, res);
    if (!guest) return;
    const data = guestEventSchema.parse(req.body);
    const event = await prisma.event.create({
      data: {
        guestSessionId: guest.id,
        title: data.title,
        description: data.description || null,
        category: data.category || null,
        location: data.location || null,
        startDate: data.startDate ? new Date(data.startDate) : new Date(),
        endDate: data.endDate ? new Date(data.endDate) : guest.expiresAt,
        visibility: data.visibility || "public",
        status: "live",
        coverImageUrl: data.coverImageUrl || null,
        qrToken: secureToken(24)
      }
    });
    const scanUrl = `${process.env.FRONTEND_URL}/event/${event.qrToken}`;
    res.status(201).json({ event, scanUrl, guest: guestPayload(guest) });
  } catch (error) {
    next(error);
  }
});

router.delete("/guest/trips/:tripId", async (req, res, next) => {
  try {
    const guest = await requireCreatorSession(req, res);
    if (!guest) return;
    const trip = await prisma.trip.findFirst({ where: { id: req.params.tripId, guestSessionId: guest.id } });
    if (!trip) return res.status(404).json({ error: "Guest album not found." });
    await prisma.trip.delete({ where: { id: trip.id } });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.delete("/guest/events/:eventId", async (req, res, next) => {
  try {
    const guest = await requireCreatorSession(req, res);
    if (!guest) return;
    const event = await prisma.event.findFirst({ where: { id: req.params.eventId, guestSessionId: guest.id } });
    if (!event) return res.status(404).json({ error: "Guest event not found." });
    await prisma.event.delete({ where: { id: event.id } });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get("/qr/:qrToken", async (req, res) => {
  getOrSetUploaderSession(req, res);
  const trip = await prisma.trip.findUnique({
    where: { qrToken: req.params.qrToken },
    include: { user: { select: { name: true } } }
  });

  if (!trip || !isOpenQr(trip)) {
    return res.status(404).json({ error: "This QR link is not accepting uploads right now." });
  }

  if (trip.qrExpiresAt && trip.qrExpiresAt < new Date()) {
    return res.status(410).json({ error: "This QR link has expired." });
  }

  const guest = await getOrCreateGuestSession(req, res, "trip", trip.id);

  res.json({
    guest: guestPayload(guest),
    trip: {
      id: trip.id,
      title: trip.title,
      destination: trip.destination,
      touristFirstName: trip.user?.name?.split(" ")[0] || "Guest host",
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
    if (!trip || !isOpenQr(trip)) {
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
    const guest = await getOrCreateGuestSession(req, res, "trip", trip.id);
    if (guest.expiresAt <= new Date()) return res.status(403).json({ error: "Guest access expired. Create an account to continue." });

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
        guestSessionId: guest.id,
        uploaderAnonId: anonId(),
        uploaderFingerprint,
        ...media,
        ...locationData(req.body),
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

router.get("/event/:qrToken", async (req, res) => {
  const event = await prisma.event.findUnique({
    where: { qrToken: req.params.qrToken },
    include: {
      maps: { where: { active: true }, take: 1 },
      zones: { orderBy: { displayOrder: "asc" }, include: { _count: { select: { uploads: true } } } },
      _count: { select: { uploads: true } }
    }
  });
  if (!event || event.status === "archived") return res.status(404).json({ error: "Event not found." });
  const guest = await getOrCreateGuestSession(req, res, "event", event.id);
  res.json({ guest: guestPayload(guest), event });
});

router.post("/event/:qrToken/uploads", uploadLimiter, upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "A photo or video is required." });
    const event = await prisma.event.findUnique({ where: { qrToken: req.params.qrToken } });
    if (!event || event.status === "archived") return res.status(404).json({ error: "Event not found." });
    const guest = await getOrCreateGuestSession(req, res, "event", event.id);
    if (guest.expiresAt <= new Date()) return res.status(403).json({ error: "Guest access expired. Create an account to continue." });
    const media = await uploadMedia(req.file);
    const moderation = await moderateMedia(media).catch((error) => ({
      provider: process.env.MODERATION_PROVIDER || "disabled",
      status: "error",
      aiFlagged: true,
      labels: { error: error.message }
    }));
    const saved = await prisma.upload.create({
      data: {
        eventId: event.id,
        guestSessionId: guest.id,
        uploaderAnonId: anonId(),
        uploaderFingerprint: fingerprintFromRequest(req),
        ...media,
        ...locationData(req.body),
        aiFlagged: moderation.aiFlagged,
        moderationProvider: moderation.provider,
        moderationStatus: moderation.status,
        moderationLabels: moderation.labels,
        status: event.status === "live" ? "pending" : "pending"
      }
    });
    res.status(201).json({ upload: saved, message: "Upload received for the event memory gallery." });
  } catch (error) {
    next(error);
  }
});

router.get("/zone/:qrToken", async (req, res) => {
  const zone = await prisma.mapZone.findUnique({
    where: { qrToken: req.params.qrToken },
    include: { event: true, _count: { select: { uploads: true } } }
  });
  if (!zone) return res.status(404).json({ error: "Event zone not found." });
  const guest = await getOrCreateGuestSession(req, res, "zone", zone.id);
  res.json({ guest: guestPayload(guest), zone });
});

router.post("/zone/:qrToken/uploads", uploadLimiter, upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "A photo or video is required." });
    const zone = await prisma.mapZone.findUnique({ where: { qrToken: req.params.qrToken }, include: { event: true } });
    if (!zone) return res.status(404).json({ error: "Event zone not found." });
    const guest = await getOrCreateGuestSession(req, res, "zone", zone.id);
    if (guest.expiresAt <= new Date()) return res.status(403).json({ error: "Guest access expired. Create an account to continue." });
    const media = await uploadMedia(req.file);
    const moderation = await moderateMedia(media).catch((error) => ({
      provider: process.env.MODERATION_PROVIDER || "disabled",
      status: "error",
      aiFlagged: true,
      labels: { error: error.message }
    }));
    const saved = await prisma.upload.create({
      data: {
        eventId: zone.eventId,
        zoneId: zone.id,
        guestSessionId: guest.id,
        uploaderAnonId: anonId(),
        uploaderFingerprint: fingerprintFromRequest(req),
        ...media,
        ...locationData({ ...req.body, locationName: req.body.locationName || zone.name }),
        aiFlagged: moderation.aiFlagged,
        moderationProvider: moderation.provider,
        moderationStatus: moderation.status,
        moderationLabels: moderation.labels,
        status: "pending"
      }
    });
    res.status(201).json({ upload: saved, message: `Upload received for ${zone.name}.` });
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
          },
          event: {
            include: {
              uploads: { where: { status: "approved" }, orderBy: { approvedAt: "desc" } }
            }
          }
      }
    });

    if (!link || !link.active) return res.status(404).json({ error: "Shared album not found." });
    if (link.pinHash) {
      const valid = data.pin && await bcrypt.compare(data.pin, link.pinHash);
      if (!valid) return res.status(401).json({ error: "PIN required." });
    }

    if (link.trip) {
      return res.json({
        trip: {
          title: link.trip.title,
          destination: link.trip.destination,
          touristName: link.trip.user?.name || "Guest host",
          uploads: link.trip.uploads.map(({ id, fileUrl, fileType, approvedAt }) => ({ id, fileUrl, fileType, approvedAt }))
        }
      });
    }
    if (link.event) {
      return res.json({
        event: {
          title: link.event.title,
          location: link.event.location,
          uploads: link.event.uploads.map(({ id, fileUrl, fileType, approvedAt }) => ({ id, fileUrl, fileType, approvedAt }))
        }
      });
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

export default router;
