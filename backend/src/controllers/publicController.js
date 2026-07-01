import { prisma } from "../utils/prisma.js";
import {
  getOrCreateGuestSession,
  getGuestLifecycle,
  getOrCreateCreatorSession,
  findCreatorSession
} from "../services/sessionService.js";
import * as uploadService from "../services/uploadService.js";
import crypto from "node:crypto";
import { readCookie, setGuestSessionCookie, fingerprintFromRequest, getOrSetUploaderSession } from "../utils/tokens.js";

/**
 * =========================
 * SHARED HELPERS
 * =========================
 */

async function guestPayload(guest, platformCache) {
  if (!guest) {
    return {
      token: null,
      state: "expired",
      activeUntil: null,
      expiresAt: null,
      daysRemaining: 0,
      shouldPromptRegister: false,
      expired: true
    };
  }
  const lifecycle = await getGuestLifecycle(guest, { platformCache });
  return {
    token: guest.token,
    state: lifecycle.state,
    activeUntil: lifecycle.activeUntil,
    expiresAt: lifecycle.expiresAt,
    daysRemaining: lifecycle.daysRemaining,
    shouldPromptRegister: lifecycle.shouldPromptRegister,
    expired: lifecycle.expired
  };
}

async function qrResponse(type, data, guest, platformCache) {
  return {
    type,
    guest: await guestPayload(guest, platformCache),
    data
  };
}

/**
 * =========================
 * SYSTEM
 * =========================
 */

export async function settings(req, res, next) {
  try {
    res.json({
      settings: {
        guestAccessDays: 3,
        maxUploadSizeMb: 50
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function appearance(req, res, next) {
  try {
    res.json({
      appearance: {
        backgroundVideoUrl: "/videos/come-to-barbados.mp4"
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * =========================
 * PUBLIC EVENTS FEED (MAP)
 * =========================
 */

export async function publicEvents(req, res, next) {
  try {
    const events = await prisma.event.findMany({
      where: {
        visibility: "public",
        status: "live"
      },
      orderBy: { startDate: "desc" }
    });

    res.json({
      events: events.map((e) => ({
        ...e,
        latitude: e.latitude ?? null,
        longitude: e.longitude ?? null
      }))
    });
  } catch (err) {
    next(err);
  }
}

export async function storePreview(req, res, next) {
  try {
    // Return active store items for public preview. Do not expose internal fields.
    const items = await prisma.purchaseItem.findMany({
      where: { active: true },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
        priceCents: true,
        previewUrl: true,
        metadata: true,
        createdAt: true
      }
    });

    const mapped = items.map((it) => {
      const metadata = it.metadata || null;
      // Provide a friendly category and assetUrl for frontend consumption
      const category = metadata && typeof metadata === 'object' && 'category' in metadata ? metadata.category : null;
      const assetUrl = metadata && typeof metadata === 'object' && (metadata.frameAssetUrl || metadata.previewImage) ? (metadata.frameAssetUrl || metadata.previewImage) : it.previewUrl || null;

      return {
        id: it.id,
        name: it.name,
        description: it.description || null,
        type: it.type,
        category,
        priceCents: it.priceCents || 0,
        previewUrl: it.previewUrl || null,
        assetUrl,
        metadata: metadata || null,
        createdAt: it.createdAt
      };
    });

    res.json({ items: mapped });
  } catch (err) {
    next(err);
  }
}

/**
 * =========================
 * 🔥 CLEAN QR SYSTEM (FIXED)
 * =========================
 */

export async function qrGet(req, res, next) {
  try {
    const token = req.params.qrToken;

    // 1. TRIP
    const trip = await prisma.trip.findUnique({
      where: { qrToken: token },
      include: { user: true }
    });

    if (trip) {
      const guest = await getOrCreateGuestSession({
        token: readCookie(req, "ts_guest") || req.get("x-guest-token"),
        deviceFingerprint: fingerprintFromRequest(req),
        platformCache: req.platformCache,
        scopeType: "trip",
        scopeId: trip.id
      });

      if (guest) setGuestSessionCookie(res, guest.token);

      return res.json(
        await qrResponse(
          "trip",
          {
            id: trip.id,
            title: trip.title,
            destination: trip.destination
          },
          guest,
          req.platformCache
        )
      );
    }

    // 2. EVENT
    const event = await prisma.event.findUnique({
      where: { qrToken: token },
      include: { zones: true }
    });

    if (event) {
      const guest = await getOrCreateGuestSession({
        token: readCookie(req, "ts_guest") || req.get("x-guest-token"),
        deviceFingerprint: fingerprintFromRequest(req),
        platformCache: req.platformCache,
        scopeType: "event",
        scopeId: event.id
      });

      if (guest) setGuestSessionCookie(res, guest.token);

      return res.json(await qrResponse("event", event, guest, req.platformCache));
    }

    // 3. ZONE
    const zone = await prisma.mapZone.findUnique({
      where: { qrToken: token },
      include: { event: true }
    });

    if (zone) {
      const guest = await getOrCreateGuestSession({
        token: readCookie(req, "ts_guest") || req.get("x-guest-token"),
        deviceFingerprint: fingerprintFromRequest(req),
        platformCache: req.platformCache,
        scopeType: "zone",
        scopeId: zone.id
      });

      if (guest) setGuestSessionCookie(res, guest.token);

      return res.json(await qrResponse("zone", zone, guest, req.platformCache));
    }

    return res.status(404).json({ error: "QR not found" });
  } catch (err) {
    next(err);
  }
}

export async function handleEventUpload(req, res) {
  res.json({ ok: true });
}

export async function handleZoneUpload(req, res) {
  res.json({ ok: true });
}

/**
 * =========================
 * UPLOAD HANDLER (UNCHANGED LOGIC WRAPPER)
 * =========================
 */

export async function handleQrUpload(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "File required" });
    }

    const token = req.params.qrToken;
    const fingerprint = fingerprintFromRequest(req);
    const guestToken = readCookie(req, "ts_guest") || req.get("x-guest-token");

    const trip = await prisma.trip.findUnique({ where: { qrToken: token } });
    if (trip) {
      const result = await uploadService.handleTripUpload({
        file: req.file,
        body: req.body,
        params: req.params,
        fingerprint,
        platformCache: req.platformCache,
        guestToken
      });

      if (result?.guest) setGuestSessionCookie(res, result.guest.token);

      return res.status(201).json({
        upload: result.saved,
        message: "Trip upload received"
      });
    }

    const event = await prisma.event.findUnique({ where: { qrToken: token } });
    if (event) {
      const result = await uploadService.handleEventUpload({
        file: req.file,
        body: req.body,
        params: req.params,
        fingerprint,
        platformCache: req.platformCache,
        guestToken
      });

      if (result?.guest) setGuestSessionCookie(res, result.guest.token);

      return res.status(201).json({
        upload: result.saved,
        message: "Event upload received"
      });
    }

    const zone = await prisma.mapZone.findUnique({ where: { qrToken: token } });
    if (zone) {
      const result = await uploadService.handleZoneUpload({
        file: req.file,
        body: req.body,
        params: req.params,
        fingerprint,
        platformCache: req.platformCache,
        guestToken
      });

      if (result?.guest) setGuestSessionCookie(res, result.guest.token);

      return res.status(201).json({
        upload: result.saved,
        message: "Zone upload received"
      });
    }

    return res.status(404).json({ error: "QR not found" });
  } catch (err) {
    next(err);
  }
}

/**
 * =========================
 * LEGACY ROUTES (KEEP SAFE)
 * =========================
 */

export async function eventGet(req, res, next) {
  try {
    const event = await prisma.event.findUnique({
      where: { qrToken: req.params.qrToken },
      include: { zones: true }
    });

    if (!event) return res.status(404).json({ error: "Event not found" });

    res.json({ event });
  } catch (err) {
    next(err);
  }
}

export async function zoneGet(req, res, next) {
  try {
    const zone = await prisma.mapZone.findUnique({
      where: { qrToken: req.params.qrToken },
      include: { event: true }
    });

    if (!zone) return res.status(404).json({ error: "Zone not found" });

    res.json({ zone });
  } catch (err) {
    next(err);
  }
}