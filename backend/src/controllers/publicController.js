import { prisma } from "../utils/prisma.js";
import {
  getOrCreateGuestSession,
  getGuestLifecycle,
  getOrCreateCreatorSession,
  findCreatorSession
} from "../services/sessionService.js";
import * as uploadService from "../services/uploadService.js";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { readCookie, setGuestSessionCookie, fingerprintFromRequest, getOrSetUploaderSession, secureToken, hashToken } from "../utils/tokens.js";
import { get as getPlatformSetting } from "../services/platformService.js";
import { publicQRSpacePayload, resolveQRUploadSpaceByToken } from "../services/qrSpaceService.js";

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
    status: lifecycle.state,
    displayName: guest.displayName || null,
    resumeAvailable: Boolean(guest.resumeCode),
    accessLink: guest.resumeCode ? `${process.env.FRONTEND_URL || "http://localhost:5173"}/guest/access/${guest.resumeCode}` : null,
    lastGuestAccessAt: guest.lastGuestAccessAt || null,
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

function publicTripQrPayload(trip) {
  return {
    id: trip.id,
    title: trip.title,
    destination: trip.destination,
    touristFirstName: trip.user?.name?.trim().split(/\s+/)[0] || "Guest host",
    supportEmail: process.env.SUPPORT_EMAIL || "support@example.com"
  };
}

function normalizeGuestResumeToken(value) {
  const input = typeof value === "string" ? value.trim() : "";
  if (!input) return "";

  try {
    const url = new URL(input);
    const pathMatch = url.pathname.match(/\/guest\/access\/([^/?#]+)/i);
    if (pathMatch?.[1]) return decodeURIComponent(pathMatch[1]);
    const queryToken = url.searchParams.get("resumeToken")
      || url.searchParams.get("accessToken")
      || url.searchParams.get("linkToken")
      || url.searchParams.get("token");
    if (queryToken) return queryToken.trim();
  } catch {
    // Raw tokens and relative guest access paths are handled below.
  }

  const pathMatch = input.match(/(?:^|\/)guest\/access\/([^/?#]+)/i);
  if (pathMatch?.[1]) {
    try {
      return decodeURIComponent(pathMatch[1]);
    } catch {
      return pathMatch[1];
    }
  }
  return input;
}

async function optionalAuthenticatedUser(req) {
  try {
    const header = req.get("authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return null;
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, email: true, role: true }
    });
  } catch {
    return null;
  }
}

function inferBackgroundMediaType(value, fallback = "video") {
  if (!value || typeof value !== "string") return fallback;
  const extension = value.toLowerCase().match(/\.([a-z0-9]{2,5})(?:[?#].*)?$/)?.[1];
  if (["mp4", "webm", "mov", "m4v"].includes(extension)) return "video";
  if (["jpg", "jpeg", "png", "webp", "gif", "avif"].includes(extension)) return "image";
  return fallback;
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
    const fallbackUrl = process.env.BACKGROUND_VIDEO_URL || "/videos/come-to-barbados.mp4";
    const storedMediaUrl = await getPlatformSetting(req.platformCache, "backgroundMediaUrl", null);
    const storedVideoUrl = await getPlatformSetting(req.platformCache, "backgroundVideoUrl", fallbackUrl);
    const storedMediaType = await getPlatformSetting(req.platformCache, "backgroundMediaType", null);
    const backgroundMediaUrl = storedMediaUrl || storedVideoUrl || fallbackUrl;
    const backgroundMediaType = storedMediaType || inferBackgroundMediaType(backgroundMediaUrl, "video");

    res.json({
      appearance: {
        backgroundVideoUrl: backgroundMediaUrl,
        backgroundMediaUrl,
        backgroundMediaType
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
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        location: true,
        latitude: true,
        longitude: true,
        startDate: true,
        endDate: true,
        coverImageUrl: true,
        visibility: true,
        status: true,
        _count: { select: { uploads: { where: { status: "approved" } } } }
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

export async function publicEventDetails(req, res, next) {
  try {
    const event = await prisma.event.findFirst({
      where: {
        id: req.params.eventId,
        visibility: "public",
        status: "live"
      },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        location: true,
        latitude: true,
        longitude: true,
        startDate: true,
        endDate: true,
        coverImageUrl: true,
        visibility: true,
        status: true,
        uploads: {
          where: { status: "approved" },
          orderBy: { createdAt: "desc" },
          select: { id: true, caption: true, fileUrl: true, fileType: true, createdAt: true, zoneId: true }
        },
        zones: {
          orderBy: { displayOrder: "asc" },
          select: { id: true, name: true, type: true, description: true, latitude: true, longitude: true }
        },
        _count: {
          select: {
            uploads: { where: { status: "approved" } },
            zones: true
          }
        }
      }
    });

    if (!event) return res.status(404).json({ error: "Event is private or unavailable." });
    return res.json({ event });
  } catch (err) {
    return next(err);
  }
}

export async function publicEventSouvenir(req, res, next) {
  try {
    const event = await prisma.event.findFirst({
      where: {
        id: req.params.eventId,
        visibility: { in: ["public", "unlisted"] },
        status: { in: ["ended", "archived"] }
      },
      select: {
        id: true, title: true, description: true, category: true, location: true,
        startDate: true, endDate: true, coverImageUrl: true, visibility: true, status: true,
        latitude: true, longitude: true,
        uploads: {
          where: { status: "approved" },
          orderBy: { createdAt: "desc" },
          select: { id: true, caption: true, fileUrl: true, fileType: true, createdAt: true, zoneId: true }
        },
        zones: {
          orderBy: { displayOrder: "asc" },
          select: { id: true, name: true, type: true, description: true, latitude: true, longitude: true }
        }
      }
    });
    if (!event) return res.status(404).json({ error: "Event souvenir not found." });
    return res.json({ event });
  } catch (error) {
    return next(error);
  }
}

export async function guestSessionStatus(req, res, next) {
  try {
    const token = readCookie(req, "ts_guest") || req.get("x-guest-token");
    if (!token) {
      return res.json({
        valid: false,
        guestSession: null,
        status: "expired",
        daysRemaining: 0,
        expiresAt: null,
        activeUntil: null,
        graceEndsAt: null
      });
    }

    const guest = await prisma.guestSession.findUnique({ where: { token } });
    if (!guest || guest.claimedById) {
      return res.json({
        valid: false,
        guestSession: null,
        status: "expired",
        daysRemaining: 0,
        expiresAt: null,
        activeUntil: null,
        graceEndsAt: null
      });
    }

    const guestSession = await guestPayload(guest, req.platformCache);
    const status = guestSession.status;
    return res.json({
      valid: !guestSession.expired,
      guestSession,
      status,
      daysRemaining: guestSession.daysRemaining,
      expiresAt: guestSession.expiresAt,
      activeUntil: guestSession.activeUntil,
      graceEndsAt: guestSession.activeUntil,
      accessLink: guestSession.accessLink
    });
  } catch (err) {
    next(err);
  }
}

export async function guestSessionCreate(req, res, next) {
  try {
    const { displayName, passcode } = z.object({
      displayName: z.string().trim().min(2).max(80),
      passcode: z.string().regex(/^\d{4}$/)
    }).parse(req.body || {});

    const guest = await getOrCreateGuestSession({
      token: readCookie(req, "ts_guest") || req.get("x-guest-token"),
      deviceFingerprint: fingerprintFromRequest(req),
      platformCache: req.platformCache
    });
    if (guest) setGuestSessionCookie(res, guest.token);

    const resumeToken = secureToken(18);
    const resumeTokenHash = hashToken(resumeToken);
    const passcodeHash = await bcrypt.hash(passcode, 10);
    await prisma.guestSession.update({
      where: { id: guest.id },
      data: {
        displayName,
        resumeCode: resumeToken,
        resumeTokenHash,
        passcodeHash,
        passcodeSetAt: new Date(),
        lastGuestAccessAt: new Date()
      }
    });

    const guestRecord = await prisma.guestSession.findUnique({ where: { id: guest.id } });
    const payload = await guestPayload(guestRecord, req.platformCache);
    const response = {
      valid: !payload.expired,
      guestSession: payload,
      status: payload.status,
      daysRemaining: payload.daysRemaining,
      expiresAt: payload.expiresAt,
      activeUntil: payload.activeUntil,
      graceEndsAt: payload.activeUntil
    };
    if (resumeToken) response.resumeToken = resumeToken;
    if (payload.accessLink) response.accessLink = payload.accessLink;
    return res.status(201).json(response);
  } catch (err) {
    next(err);
  }
}

export async function guestSessionResume(req, res, next) {
  try {
    const input = z.object({
      resumeToken: z.string().trim().min(1).max(2048).optional(),
      token: z.string().trim().min(1).max(2048).optional(),
      accessToken: z.string().trim().min(1).max(2048).optional(),
      linkToken: z.string().trim().min(1).max(2048).optional(),
      displayName: z.string().trim().min(2).max(80).optional(),
      name: z.string().trim().min(2).max(80).optional(),
      passcode: z.string().regex(/^\d{4}$/).optional(),
      pin: z.string().regex(/^\d{4}$/).optional()
    }).refine((value) => Boolean(value.passcode || value.pin), {
      message: "A 4-digit PIN is required."
    }).refine((value) => Boolean(
      value.resumeToken || value.token || value.accessToken || value.linkToken || value.displayName || value.name
    ), {
      message: "Guest name or resume token is required."
    }).parse(req.body || {});

    const passcode = input.passcode || input.pin;
    const displayName = input.displayName || input.name;
    const resumeToken = normalizeGuestResumeToken(
      input.resumeToken || input.token || input.accessToken || input.linkToken
    );

    let guest = null;
    if (resumeToken) {
      guest = await prisma.guestSession.findUnique({ where: { resumeTokenHash: hashToken(resumeToken) } });
      if (!guest) guest = await prisma.guestSession.findUnique({ where: { resumeCode: resumeToken } });
      const valid = Boolean(guest?.passcodeHash) && await bcrypt.compare(passcode, guest.passcodeHash);
      if (!guest || guest.claimedById || !valid) {
        return res.status(401).json({ error: "Invalid guest name or PIN." });
      }
    } else {
      const candidates = await prisma.guestSession.findMany({
        where: {
          displayName: { equals: displayName, mode: "insensitive" },
          claimedById: null,
          passcodeHash: { not: null }
        },
        orderBy: { createdAt: "desc" },
        take: 20
      });
      for (const candidate of candidates) {
        if (await bcrypt.compare(passcode, candidate.passcodeHash)) {
          guest = candidate;
          break;
        }
      }
      if (!guest) return res.status(401).json({ error: "Invalid guest name or PIN." });
    }

    const lifecycle = await getGuestLifecycle(guest, { platformCache: req.platformCache });
    if (lifecycle.expired) return res.status(403).json({ error: "Guest session expired." });

    // update last access
    await prisma.guestSession.update({ where: { id: guest.id }, data: { lastGuestAccessAt: new Date() } });

    // set cookie and return session payload
    setGuestSessionCookie(res, guest.token);
    const payload = await guestPayload(guest, req.platformCache);
    return res.json({ guestToken: guest.token, guestSession: payload, accessLink: payload.accessLink });
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

export async function shareUnlock(req, res, next) {
  try {
    const { pin } = z.object({
      pin: z.string().optional().nullable()
    }).parse(req.body || {});

    const link = await prisma.shareLink.findUnique({
      where: { token: req.params.token },
      select: {
        active: true,
        pinHash: true,
        trip: {
          select: {
            title: true,
            destination: true,
            user: { select: { name: true } },
            uploads: {
              where: { status: "approved" },
              orderBy: { approvedAt: "desc" },
              select: {
                id: true,
                fileUrl: true,
                fileType: true,
                approvedAt: true
              }
            }
          }
        },
        event: {
          select: {
            title: true,
            location: true,
            uploads: {
              where: { status: "approved" },
              orderBy: { approvedAt: "desc" },
              select: {
                id: true,
                fileUrl: true,
                fileType: true,
                approvedAt: true
              }
            }
          }
        }
      }
    });

    if (!link || !link.active) {
      return res.status(404).json({ error: "Shared album not found." });
    }

    if (link.pinHash) {
      const valid = typeof pin === "string" && await bcrypt.compare(pin, link.pinHash);
      if (!valid) return res.status(401).json({ error: "PIN required." });
    }

    if (link.trip) {
      return res.json({
        trip: {
          title: link.trip.title,
          destination: link.trip.destination,
          touristName: link.trip.user?.name || "Guest host",
          uploads: link.trip.uploads
        }
      });
    }

    if (link.event) {
      return res.json({
        event: {
          title: link.event.title,
          location: link.event.location,
          uploads: link.event.uploads
        }
      });
    }

    return res.status(404).json({ error: "Shared album not found." });
  } catch (error) {
    next(error);
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
      include: { user: { select: { name: true } } }
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

      const publicTrip = publicTripQrPayload(trip);
      const response = await qrResponse("trip", publicTrip, guest, req.platformCache);

      return res.json({
        ...response,
        // Backward-compatible contract used by the original public QR upload flow.
        trip: publicTrip
      });
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

    // 4. STANDALONE QR UPLOAD SPACE
    const qrSpace = await resolveQRUploadSpaceByToken(token, { incrementScan: true });

    if (qrSpace) {
      const guest = await getOrCreateGuestSession({
        token: readCookie(req, "ts_guest") || req.get("x-guest-token"),
        deviceFingerprint: fingerprintFromRequest(req),
        platformCache: req.platformCache,
        scopeType: "qr_space",
        scopeId: qrSpace.id
      });

      if (guest) setGuestSessionCookie(res, guest.token);

      const payload = publicQRSpacePayload(qrSpace);
      return res.json({
        type: "upload_space",
        guest: await guestPayload(guest, req.platformCache),
        data: payload,
        ...payload
      });
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

    const qrSpace = await resolveQRUploadSpaceByToken(token, { incrementScan: false });
    if (qrSpace) {
      const result = await uploadService.handleQRSpaceUpload({
        file: req.file,
        body: req.body,
        params: req.params,
        fingerprint,
        platformCache: req.platformCache,
        guestToken,
        registeredUser: await optionalAuthenticatedUser(req)
      });

      if (result?.guest) setGuestSessionCookie(res, result.guest.token);

      return res.status(201).json({
        upload: result.saved,
        message: "QR upload-space upload received"
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
