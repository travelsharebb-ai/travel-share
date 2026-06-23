import { prisma } from "../utils/prisma.js";
import { getOrCreateGuestSession, getOrCreateCreatorSession, findCreatorSession } from "../services/sessionService.js";
import * as uploadService from "../services/uploadService.js";
import { get as platformGet } from "../services/platformService.js";
import { guestTripSchema, guestEventSchema } from "../utils/validation.js";
import crypto from "node:crypto";
import { readCookie, setGuestSessionCookie, fingerprintFromRequest, getOrSetUploaderSession } from "../utils/tokens.js";

export async function settings(req, res, next) {
  try {
    const platformCache = req.platformCache;
    const guestAccessDays = Number(await platformGet(platformCache, "guestAccessDays", process.env.GUEST_ACCESS_DAYS || 3));
    const guestDeletionDays = Number(await platformGet(platformCache, "guestDeletionDays", process.env.GUEST_DELETION_DAYS || 14));
    const maxUploadSizeMb = Number(await platformGet(platformCache, "maxUploadSizeMb", process.env.MAX_UPLOAD_SIZE_MB || 50));
    const defaultPrivacy = await platformGet(platformCache, "defaultPrivacy", process.env.DEFAULT_LOCATION_VISIBILITY || "approximate");
    const moderationProvider = await platformGet(platformCache, "moderationProvider", process.env.MODERATION_PROVIDER || "disabled");
    const mapProvider = await platformGet(platformCache, "mapProvider", "mapbox");
    const paymentProvider = await platformGet(platformCache, "paymentProvider", process.env.PAYMENT_PROVIDER || "planned_stripe");
    const backgroundVideoUrl = await platformGet(platformCache, "backgroundVideoUrl", process.env.BACKGROUND_VIDEO_URL || "/videos/come-to-barbados.mp4");

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
  } catch (err) {
    next(err);
  }
}

export async function appearance(req, res, next) {
  try {
    const backgroundVideoUrl = await platformGet(req.platformCache, "backgroundVideoUrl", process.env.BACKGROUND_VIDEO_URL || "/videos/come-to-barbados.mp4");
    res.json({ appearance: { backgroundVideoUrl } });
  } catch (err) {
    next(err);
  }
}

export async function qrGet(req, res, next) {
  try {
    // ensure uploader session cookie exists
    getOrSetUploaderSession(req, res);
    // Resolve QR token to trip, event, or zone. Return metadata even when uploads are gated.
    const token = req.params.qrToken;
    // 1) Try trip
    const trip = await prisma.trip.findUnique({ where: { qrToken: token }, include: { user: { select: { name: true } } } });
    if (trip) {
      if (trip.qrExpiresAt && trip.qrExpiresAt < new Date()) return res.status(410).json({ error: "This QR link has expired." });
      const guestToken = readCookie(req, 'ts_guest') || req.get('x-guest-token');
      const fingerprint = fingerprintFromRequest(req);
      const guest = await getOrCreateGuestSession({ token: guestToken, deviceFingerprint: fingerprint, platformCache: req.platformCache, scopeType: 'trip', scopeId: trip.id });
      if (guest) setGuestSessionCookie(res, guest.token);
      return res.json({
        guest: { token: guest?.token, expiresAt: guest?.expiresAt, expired: guest?.expiresAt <= new Date() },
        trip: {
          id: trip.id,
          title: trip.title,
          destination: trip.destination,
          touristFirstName: trip.user?.name?.split(" ")[0] || "Guest host",
          supportEmail: process.env.SUPPORT_EMAIL || "support@example.com"
        }
      });
    }

    // 2) Try event
    const event = await prisma.event.findUnique({ where: { qrToken: token }, include: { zones: { include: {} }, _count: { select: { uploads: true } } } }).catch(() => null);
    if (event) {
      if (event.status === 'archived') return res.status(404).json({ error: 'Event not found.' });
      const guestToken = readCookie(req, 'ts_guest') || req.get('x-guest-token');
      const fingerprint = fingerprintFromRequest(req);
      const guest = await getOrCreateGuestSession({ token: guestToken, deviceFingerprint: fingerprint, platformCache: req.platformCache, scopeType: 'event', scopeId: event.id });
      if (guest) setGuestSessionCookie(res, guest.token);
      return res.json({ guest: { token: guest?.token, expiresAt: guest?.expiresAt, expired: guest?.expiresAt <= new Date() }, event });
    }

    // 3) Try zone
    const zone = await prisma.mapZone.findUnique({ where: { qrToken: token }, include: { event: true } }).catch(() => null);
    if (zone) {
      const guestToken = readCookie(req, 'ts_guest') || req.get('x-guest-token');
      const fingerprint = fingerprintFromRequest(req);
      const guest = await getOrCreateGuestSession({ token: guestToken, deviceFingerprint: fingerprint, platformCache: req.platformCache, scopeType: 'zone', scopeId: zone.id });
      if (guest) setGuestSessionCookie(res, guest.token);
      return res.json({ guest: { token: guest?.token, expiresAt: guest?.expiresAt, expired: guest?.expiresAt <= new Date() }, zone });
    }

    return res.status(404).json({ error: 'QR not found' });
  } catch (err) {
    next(err);
  }
}

export async function eventGet(req, res, next) {
  try {
    let event = null;
    try {
      event = await prisma.event.findUnique({
        where: { qrToken: req.params.qrToken },
        include: { zones: { include: {} }, _count: { select: { uploads: true } } }
      });
    } catch (err) {
      console.warn('event.findUnique failed', err?.message || err);
      event = null;
    }
    if (!event || event.status === 'archived') return res.status(404).json({ error: 'Event not found.' });
    const guestToken = readCookie(req, 'ts_guest') || req.get('x-guest-token');
    const fingerprint = fingerprintFromRequest(req);
    const guest = await getOrCreateGuestSession({ token: guestToken, deviceFingerprint: fingerprint, platformCache: req.platformCache, scopeType: 'event', scopeId: event.id });
    if (guest) setGuestSessionCookie(res, guest.token);
    res.json({ guest: { token: guest?.token, expiresAt: guest?.expiresAt, expired: guest?.expiresAt <= new Date() }, event });
  } catch (err) {
    next(err);
  }
}

export async function zoneGet(req, res, next) {
  try {
    let zone = null;
    try {
      zone = await prisma.mapZone.findUnique({ where: { qrToken: req.params.qrToken }, include: { event: true } });
    } catch (err) {
      console.warn('mapZone.findUnique failed', err?.message || err);
      zone = null;
    }
    if (!zone) return res.status(404).json({ error: 'Event zone not found.' });
    const guestToken = readCookie(req, 'ts_guest') || req.get('x-guest-token');
    const fingerprint = fingerprintFromRequest(req);
    const guest = await getOrCreateGuestSession({ token: guestToken, deviceFingerprint: fingerprint, platformCache: req.platformCache, scopeType: 'zone', scopeId: zone.id });
    if (guest) setGuestSessionCookie(res, guest.token);
    res.json({ guest: { token: guest?.token, expiresAt: guest?.expiresAt, expired: guest?.expiresAt <= new Date() }, zone });
  } catch (err) {
    next(err);
  }
}

export async function guestCreatorView(req, res, next) {
  try {
    const token = readCookie(req, 'ts_creator') || req.get('x-guest-token');
    const guest = await findCreatorSession({ token });
    if (!guest || guest.claimedById) return res.status(401).json({ success: false, error: "Guest creator session not found. Start a guest space again." });
    if (guest.expiresAt <= new Date()) return res.status(403).json({ success: false, error: "Guest creator access expired. Create an account to continue." });
    const [trips, events] = await Promise.all([
      prisma.trip.findMany({ where: { guestSessionId: guest.id }, include: { _count: { select: { uploads: true } } }, orderBy: { createdAt: 'desc' } }),
      prisma.event.findMany({ where: { guestSessionId: guest.id }, include: { _count: { select: { uploads: true, zones: true } } }, orderBy: { createdAt: 'desc' } })
    ]);
    res.json({ guest: { token: guest.token, expiresAt: guest.expiresAt, expired: guest.expiresAt <= new Date() }, trips, events });
  } catch (err) {
    next(err);
  }
}

export async function handleQrUpload(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: "File required" });
    const guestToken = readCookie(req, 'ts_guest') || req.get('x-guest-token');
    const fingerprint = fingerprintFromRequest(req);
    // Dispatch uploads to the appropriate handler based on the QR token type.
    // The `/qr/:qrToken/uploads` route can resolve to a trip, event, or zone.
    const token = req.params.qrToken;
    // Try trip first
    const trip = await prisma.trip.findUnique({ where: { qrToken: token } });
    if (trip) {
      const result = await uploadService.handleTripUpload({ file: req.file, body: req.body, params: req.params, fingerprint, platformCache: req.platformCache, guestToken });
      if (result && result.guest) setGuestSessionCookie(res, result.guest.token);
      const saved = result.saved;
      return res.status(201).json({ upload: { id: saved.id, status: saved.status, uploaderAnonId: saved.uploaderAnonId }, message: "Upload received. It is private until the tourist approves it." });
    }

    // Try event
    const event = await prisma.event.findUnique({ where: { qrToken: token } }).catch(() => null);
    if (event) {
      const result = await uploadService.handleEventUpload({ file: req.file, body: req.body, params: req.params, fingerprint, platformCache: req.platformCache, guestToken });
      if (result && result.guest) setGuestSessionCookie(res, result.guest.token);
      return res.status(201).json({ upload: result.saved, message: "Upload received for the event memory gallery." });
    }

    // Try zone
    const zone = await prisma.mapZone.findUnique({ where: { qrToken: token } }).catch(() => null);
    if (zone) {
      const result = await uploadService.handleZoneUpload({ file: req.file, body: req.body, params: req.params, fingerprint, platformCache: req.platformCache, guestToken });
      if (result && result.guest) setGuestSessionCookie(res, result.guest.token);
      return res.status(201).json({ upload: result.saved, message: `Upload received for ${result.saved.locationName || 'zone'}.` });
    }

    return res.status(404).json({ success: false, error: 'QR not accepting uploads' });
  } catch (err) {
    next(err);
  }
}

export async function handleEventUpload(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: "File required" });
    const guestToken = readCookie(req, 'ts_guest') || req.get('x-guest-token');
    const fingerprint = fingerprintFromRequest(req);
    const result = await uploadService.handleEventUpload({ file: req.file, body: req.body, params: req.params, fingerprint, platformCache: req.platformCache, guestToken });
    if (result && result.guest) setGuestSessionCookie(res, result.guest.token);
    res.status(201).json({ upload: result.saved, message: "Upload received for the event memory gallery." });
  } catch (err) {
    next(err);
  }
}

export async function handleZoneUpload(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: "File required" });
    const guestToken = readCookie(req, 'ts_guest') || req.get('x-guest-token');
    const fingerprint = fingerprintFromRequest(req);
    const result = await uploadService.handleZoneUpload({ file: req.file, body: req.body, params: req.params, fingerprint, platformCache: req.platformCache, guestToken });
    if (result && result.guest) setGuestSessionCookie(res, result.guest.token);
    res.status(201).json({ upload: result.saved, message: `Upload received for ${result.saved.locationName || 'zone'}.` });
  } catch (err) {
    next(err);
  }
}

export async function guestCreator(req, res, next) {
  try {
    const token = readCookie(req, 'ts_creator') || req.get('x-guest-token');
    const fingerprint = fingerprintFromRequest(req);
    const platformCache = req.platformCache;
    const guest = await getOrCreateCreatorSession({ token, deviceFingerprint: fingerprint, platformCache });
    if (!guest) return res.status(500).json({ error: 'Failed to create guest creator session.' });
    setGuestSessionCookie(res, guest.token, { name: 'ts_creator' });
    res.status(201).json({ guest: { token: guest.token, expiresAt: guest.expiresAt, expired: guest.expiresAt <= new Date() } });
  } catch (err) { next(err); }
}

export async function guestCreateTrip(req, res, next) {
  try {
    const token = readCookie(req, 'ts_creator') || req.get('x-guest-token');
    const platformCache = req.platformCache;
    const guest = await findCreatorSession({ token });
    if (!guest || guest.claimedById) return res.status(401).json({ success: false, error: "Guest creator session not found. Start a guest space again." });
    if (guest.expiresAt <= new Date()) return res.status(403).json({ success: false, error: "Guest creator access expired. Create an account to continue." });
    const data = guestTripSchema.parse(req.body);
    const trip = await prisma.trip.create({
      data: {
        guestSessionId: guest.id,
        title: data.title,
        destination: data.destination,
        defaultLocationVisibility: data.defaultLocationVisibility || 'approximate',
        qrToken: crypto.randomBytes(16).toString('hex'),
        qrExpiresAt: guest.expiresAt,
        qrMode: 'approval_required'
      }
    });
    const scanUrl = `${process.env.FRONTEND_URL}/qr/${trip.qrToken}`;
    res.status(201).json({ trip, scanUrl, guest: { token: guest.token, expiresAt: guest.expiresAt, expired: guest.expiresAt <= new Date() } });
  } catch (err) {
    next(err);
  }
}

export async function guestGetTrip(req, res, next) {
  try {
    const token = readCookie(req, 'ts_creator') || req.get('x-guest-token');
    const guest = await findCreatorSession({ token });
    if (!guest || guest.claimedById) return res.status(401).json({ success: false, error: "Guest creator session not found. Start a guest space again." });
    if (guest.expiresAt <= new Date()) return res.status(403).json({ success: false, error: "Guest creator access expired. Create an account to continue." });
    const trip = await prisma.trip.findFirst({ where: { id: req.params.tripId, guestSessionId: guest.id }, include: { uploads: { orderBy: { createdAt: 'desc' } }, shareLinks: { orderBy: { createdAt: 'desc' } }, _count: { select: { uploads: true } } } });
    if (!trip) return res.status(404).json({ error: 'Guest album not found.' });
    const scanUrl = `${process.env.FRONTEND_URL}/qr/${trip.qrToken}`;
    res.json({ trip, scanUrl, guest: { token: guest.token, expiresAt: guest.expiresAt, expired: guest.expiresAt <= new Date() } });
  } catch (err) { next(err); }
}

export async function guestCreateTripShareLink(req, res, next) {
  try {
    const token = readCookie(req, 'ts_creator') || req.get('x-guest-token');
    const guest = await findCreatorSession({ token });
    if (!guest || guest.claimedById) return res.status(401).json({ success: false, error: "Guest creator session not found. Start a guest space again." });
    if (guest.expiresAt <= new Date()) return res.status(403).json({ success: false, error: "Guest creator access expired. Create an account to continue." });
    const trip = await prisma.trip.findFirst({ where: { id: req.params.tripId, guestSessionId: guest.id } });
    if (!trip) return res.status(404).json({ error: 'Guest album not found.' });
    try {
      const shareLink = await prisma.shareLink.create({ data: { tripId: trip.id, token: crypto.randomBytes(16).toString('hex') } });
      return res.status(201).json({ shareLink, url: `${process.env.FRONTEND_URL}/share/${shareLink.token}` });
    } catch (err) {
      console.warn('shareLink.create failed or unsupported in schema:', err && err.message ? err.message : err);
      return res.status(501).json({ error: 'Share link feature unavailable.' });
    }
  } catch (err) { next(err); }
}

export async function guestCreateEventShareLink(req, res, next) {
  try {
    const token = readCookie(req, 'ts_creator') || req.get('x-guest-token');
    const guest = await findCreatorSession({ token });
    if (!guest || guest.claimedById) return res.status(401).json({ success: false, error: "Guest creator session not found. Start a guest space again." });
    if (guest.expiresAt <= new Date()) return res.status(403).json({ success: false, error: "Guest creator access expired. Create an account to continue." });
    const event = await prisma.event.findFirst({ where: { id: req.params.eventId, guestSessionId: guest.id } });
    if (!event) return res.status(404).json({ error: 'Guest event not found.' });
    try {
      const shareLink = await prisma.shareLink.create({ data: { eventId: event.id, token: crypto.randomBytes(16).toString('hex') } });
      return res.status(201).json({ shareLink, url: `${process.env.FRONTEND_URL}/share/${shareLink.token}` });
    } catch (err) {
      console.warn('shareLink.create failed or unsupported in schema:', err && err.message ? err.message : err);
      return res.status(501).json({ error: 'Share link feature unavailable.' });
    }
  } catch (err) { next(err); }
}

export async function guestCreateEvent(req, res, next) {
  try {
    const token = readCookie(req, 'ts_creator') || req.get('x-guest-token');
    const guest = await findCreatorSession({ token });
    if (!guest || guest.claimedById) return res.status(401).json({ success: false, error: "Guest creator session not found. Start a guest space again." });
    if (guest.expiresAt <= new Date()) return res.status(403).json({ success: false, error: "Guest creator access expired. Create an account to continue." });
    const data = guestEventSchema.parse(req.body);
    const event = await prisma.event.create({ data: { guestSessionId: guest.id, title: data.title, description: data.description || null, category: data.category || null, location: data.location || null, startDate: data.startDate ? new Date(data.startDate) : new Date(), endDate: data.endDate ? new Date(data.endDate) : guest.expiresAt, visibility: data.visibility || 'public', status: 'live', coverImageUrl: data.coverImageUrl || null, qrToken: crypto.randomBytes(16).toString('hex') } });
    const scanUrl = `${process.env.FRONTEND_URL}/event/${event.qrToken}`;
    res.status(201).json({ event, scanUrl, guest: { token: guest.token, expiresAt: guest.expiresAt, expired: guest.expiresAt <= new Date() } });
  } catch (err) { next(err); }
}

export async function guestDeleteTrip(req, res, next) {
  try {
    const token = readCookie(req, 'ts_creator') || req.get('x-guest-token');
    const guest = await findCreatorSession({ token });
    if (!guest || guest.claimedById) return res.status(401).json({ success: false, error: "Guest creator session not found. Start a guest space again." });
    if (guest.expiresAt <= new Date()) return res.status(403).json({ success: false, error: "Guest creator access expired. Create an account to continue." });
    const trip = await prisma.trip.findFirst({ where: { id: req.params.tripId, guestSessionId: guest.id } });
    if (!trip) return res.status(404).json({ error: 'Guest album not found.' });
    await prisma.trip.delete({ where: { id: trip.id } });
    res.status(204).end();
  } catch (err) { next(err); }
}

export async function guestDeleteEvent(req, res, next) {
  try {
    const token = readCookie(req, 'ts_creator') || req.get('x-guest-token');
    const guest = await findCreatorSession({ token });
    if (!guest || guest.claimedById) return res.status(401).json({ success: false, error: "Guest creator session not found. Start a guest space again." });
    if (guest.expiresAt <= new Date()) return res.status(403).json({ success: false, error: "Guest creator access expired. Create an account to continue." });
    const event = await prisma.event.findFirst({ where: { id: req.params.eventId, guestSessionId: guest.id } });
    if (!event) return res.status(404).json({ error: 'Guest event not found.' });
    await prisma.event.delete({ where: { id: event.id } });
    res.status(204).end();
  } catch (err) { next(err); }
}

export async function guestCreatorDelete(req, res, next) {
  try {
    const token = readCookie(req, "ts_guest") || req.get("x-guest-token");
    if (token) {
      await prisma.guestSession.updateMany({
        where: { token, scopeType: "creator", claimedById: null },
        data: { expiresAt: new Date() }
      });
    }
    res.status(204).end();
  } catch (err) { next(err); }
}

export default {
  settings,
  appearance,
  qrGet,
  eventGet,
  zoneGet,
  handleQrUpload,
  handleEventUpload,
  handleZoneUpload,
  guestCreator,
  guestCreatorView,
  guestCreateTrip,
  guestGetTrip,
  guestCreateTripShareLink,
  guestCreateEventShareLink,
  guestCreateEvent,
  guestDeleteTrip,
  guestDeleteEvent
};
