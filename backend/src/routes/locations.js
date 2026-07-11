import { Router } from "express";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { prisma } from "../utils/prisma.js";

const router = Router();

function normalizeSafeCoordinates(upload) {
  if (!upload || upload.locationVisibility === 'hidden') return { latitude: null, longitude: null };
  const hasExact = upload.locationVisibility === 'exact';
  const hasApproximate = upload.locationVisibility === 'approximate';
  const hasCity = upload.locationVisibility === 'city';
  const baseLat = upload.latitude ?? upload.approximateLatitude ?? null;
  const baseLng = upload.longitude ?? upload.approximateLongitude ?? null;

  if (hasExact) {
    return { latitude: upload.latitude, longitude: upload.longitude };
  }
  if (hasApproximate) {
    return {
      latitude: upload.approximateLatitude ?? (baseLat !== null ? Math.round(baseLat * 100) / 100 : null),
      longitude: upload.approximateLongitude ?? (baseLng !== null ? Math.round(baseLng * 100) / 100 : null)
    };
  }
  if (hasCity) {
    return {
      latitude: baseLat !== null ? Math.round(baseLat * 10) / 10 : null,
      longitude: baseLng !== null ? Math.round(baseLng * 10) / 10 : null
    };
  }

  return {
    latitude: upload.approximateLatitude ?? upload.latitude ?? null,
    longitude: upload.approximateLongitude ?? upload.longitude ?? null
  };
}

function sanitizeReplayTitle(upload) {
  if (upload.caption) return upload.caption;
  if (upload.locationName) return upload.locationName;
  if (upload.region) return upload.region;
  return "Travel memory";
}

function clampLimit(value) {
  const limit = Number(value ?? 200);
  if (!Number.isFinite(limit) || limit <= 0) return 200;
  return Math.min(1000, Math.max(1, Math.trunc(limit)));
}

function supportedLocationFilter(value) {
  const filter = String(value || "all").toLowerCase();
  return ["all", "events", "trips", "photos", "travel_posts", "trending", "friends"].includes(filter)
    ? filter
    : "all";
}

async function optionalUser(req) {
  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true }
    });
  } catch {
    return null;
  }
}

// Create a location
router.post("/", async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Authentication required to create locations." });
    const schema = z.object({
      name: z.string().min(1).max(200),
      address: z.string().optional(),
      latitude: z.number().optional(),
      longitude: z.number().optional()
    });
    const data = schema.parse(req.body);
    const created = await prisma.location.create({
      data: {
        name: data.name,
        address: data.address || null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        userId: req.user?.id || null
      }
    });
    res.status(201).json({ location: created });
  } catch (error) {
    next(error);
  }
});

// List locations (optionally filter by userId)
router.get("/", async (req, res, next) => {
  try {
    const filter = supportedLocationFilter(req.query.filter);
    let followedUserIds = [];
    if (filter === "friends") {
      const user = req.user || await optionalUser(req);
      if (!user || user.role === "guest") {
        return res.json({
          locations: [],
          filter,
          friendsSupported: true,
          authRequired: true,
          message: "Sign in to view friend locations."
        });
      }
      const follows = await prisma.userFollow.findMany({
        where: { followerId: user.id },
        select: { followingId: true }
      });
      followedUserIds = follows.map((follow) => follow.followingId);
      if (followedUserIds.length === 0) {
        return res.json({
          locations: [],
          filter,
          friendsSupported: true,
          emptyReason: "no_follows",
          message: "No friend locations yet."
        });
      }
    }

    const where = {};
    if (req.query.userId) where.userId = String(req.query.userId);
    where.hidden = false;
    const approvedVisibleUpload = {
      status: 'approved',
      locationVisibility: { not: 'hidden' }
    };
    const friendUploadFilter = {
      ...approvedVisibleUpload,
      OR: [
        { trip: { userId: { in: followedUserIds } } },
        { event: { organizerId: { in: followedUserIds } } }
      ]
    };
    const uploadWhere = filter === "friends" ? friendUploadFilter : approvedVisibleUpload;
    if (filter === "events") where.uploads = { some: { ...approvedVisibleUpload, eventId: { not: null } } };
    if (filter === "trips") where.uploads = { some: { ...approvedVisibleUpload, tripId: { not: null } } };
    if (filter === "photos" || filter === "trending") where.uploads = { some: approvedVisibleUpload };
    if (filter === "travel_posts") where.uploads = { some: { ...approvedVisibleUpload, tripId: null, eventId: null } };
    if (filter === "friends") where.uploads = { some: friendUploadFilter };

    const items = await prisma.location.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        uploads: {
          where: uploadWhere,
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            fileUrl: true,
            fileType: true,
            createdAt: true,
            caption: true,
            tripId: true,
            eventId: true,
            latitude: true,
            longitude: true,
            approximateLatitude: true,
            approximateLongitude: true,
            locationVisibility: true,
            region: true,
            guestSessionId: true,
            trip: {
              select: {
                id: true,
                title: true,
                user: { select: { id: true, name: true } }
              }
            },
            event: { select: { id: true, title: true, organizerId: true } }
          }
        }
      }
    });
    const enriched = items.map((location) => {
      const previewUpload = location.uploads && location.uploads.length ? location.uploads[0] : null;
      const hasExact = previewUpload?.locationVisibility === 'exact';
      const hasApproximate = previewUpload?.locationVisibility === 'approximate';
      const hasCity = previewUpload?.locationVisibility === 'city';

      let safeLatitude = location.latitude;
      let safeLongitude = location.longitude;
      let safeAddress = location.address;

      if (previewUpload) {
        if (hasExact) {
          safeLatitude = location.latitude;
          safeLongitude = location.longitude;
          safeAddress = location.address;
        } else if (hasApproximate) {
          safeLatitude = previewUpload.approximateLatitude ?? previewUpload.latitude;
          safeLongitude = previewUpload.approximateLongitude ?? previewUpload.longitude;
          safeAddress = null;
        } else if (hasCity) {
          const baseLat = previewUpload.latitude ?? previewUpload.approximateLatitude;
          const baseLng = previewUpload.longitude ?? previewUpload.approximateLongitude;
          safeLatitude = baseLat != null ? Math.round(baseLat * 10) / 10 : null;
          safeLongitude = baseLng != null ? Math.round(baseLng * 10) / 10 : null;
          safeAddress = null;
        }
      }
      const uploads = Array.isArray(location.uploads) ? location.uploads : [];
      const tripCount = uploads.filter((upload) => upload.tripId).length;
      const eventCount = uploads.filter((upload) => upload.eventId).length;
      const travelPostCount = uploads.filter((upload) => !upload.tripId && !upload.eventId).length;
      const photoCount = uploads.length;
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const recentPostCount = uploads.filter((upload) => new Date(upload.createdAt).getTime() >= thirtyDaysAgo).length;
      const lastUploadAt = uploads[0]?.createdAt || null;
      const ownerIds = Array.from(new Set(uploads.flatMap((upload) => [
        upload.trip?.user?.id,
        upload.event?.organizerId
      ]).filter(Boolean)));

      const latest = uploads.length ? uploads[0] : null;
      const preview = latest
        ? {
            id: latest.id,
            imageUrl: latest.fileUrl,
            fileType: latest.fileType,
            createdAt: latest.createdAt,
            title: latest.caption || latest.trip?.title || latest.event?.title || null,
            tripId: latest.tripId || null,
            eventId: latest.eventId || null,
            userDisplayName: latest.trip?.user?.name || null,
            type: latest.fileType
          }
        : null;

      return {
        id: location.id,
        name: location.name,
        address: safeAddress,
        latitude: safeLatitude,
        longitude: safeLongitude,
        userId: location.userId,
        createdAt: location.createdAt,
        mapMeta: {
          tripCount,
          eventCount,
          photoCount,
          travelPostCount,
          recentPostCount,
          lastUploadAt,
          trendingScore: recentPostCount * 2 + photoCount,
          ownerIds,
          friendsSupported: true
        },
        uploads: uploads.map((upload) => ({
          id: upload.id,
          tripId: upload.tripId || null,
          eventId: upload.eventId || null,
          region: upload.region || null,
          createdAt: upload.createdAt,
          fileType: upload.fileType,
          locationVisibility: upload.locationVisibility
        })),
        preview
      };
    });
    const sorted = filter === "trending"
      ? enriched.sort((a, b) => {
          const scoreDelta = (b.mapMeta?.trendingScore || 0) - (a.mapMeta?.trendingScore || 0);
          if (scoreDelta !== 0) return scoreDelta;
          return new Date(b.mapMeta?.lastUploadAt || b.createdAt || 0) - new Date(a.mapMeta?.lastUploadAt || a.createdAt || 0);
        })
      : enriched;
    res.json({ locations: sorted, filter, friendsSupported: true });
  } catch (error) {
    next(error);
  }
});

  router.get("/heatmap", async (req, res, next) => {
    try {
      const limit = clampLimit(req.query.limit);
      const uploads = await prisma.upload.findMany({
        where: {
          status: 'approved',
          locationVisibility: { not: 'hidden' }
        },
        select: {
          locationVisibility: true,
          locationName: true,
          region: true,
          latitude: true,
          longitude: true,
          approximateLatitude: true,
          approximateLongitude: true
        },
        orderBy: { createdAt: 'desc' },
        take: limit
      });

      const groups = new Map();
      for (const upload of uploads) {
        const coords = normalizeSafeCoordinates(upload);
        if (coords.latitude === null || coords.longitude === null) continue;
        const key = `${coords.latitude}:${coords.longitude}`;
        const existing = groups.get(key) || {
          latitude: coords.latitude,
          longitude: coords.longitude,
          weight: 0,
          count: 0,
          city: upload.locationName || null,
          region: upload.region || null,
          country: null
        };
        existing.weight += 1;
        existing.count += 1;
        groups.set(key, existing);
      }

      res.json({ heatmap: Array.from(groups.values()) });
    } catch (error) {
      console.error('Heatmap endpoint error:', error);
      res.status(200).json({ heatmap: [] });
    }
  });

  router.get("/replay", async (req, res, next) => {
    try {
      const limit = clampLimit(req.query.limit);
      const uploads = await prisma.upload.findMany({
        where: {
          status: 'approved',
          locationVisibility: { not: 'hidden' }
        },
        select: {
          id: true,
          createdAt: true,
          fileType: true,
          caption: true,
          locationName: true,
          region: true,
          latitude: true,
          longitude: true,
          approximateLatitude: true,
          approximateLongitude: true,
          locationVisibility: true
        },
        orderBy: { createdAt: 'asc' },
        take: limit
      });

      const replay = uploads
        .map((upload) => {
          const coords = normalizeSafeCoordinates(upload);
          if (coords.latitude === null || coords.longitude === null) return null;
          return {
            id: upload.id,
            latitude: coords.latitude,
            longitude: coords.longitude,
            timestamp: upload.createdAt,
            type: upload.fileType || 'photo',
            title: sanitizeReplayTitle(upload),
            city: upload.locationName || null,
            region: upload.region || null,
            country: null
          };
        })
        .filter(Boolean);

      res.json({ replay });
    } catch (error) {
      console.error('Replay endpoint error:', error);
      res.status(200).json({ replay: [] });
    }
  });

// Get a single location and its photos
router.get("/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    const location = await prisma.location.findUnique({ where: { id } });
    if (!location || location.hidden) return res.status(404).json({ error: "Location not found." });
    const publicUpload = await prisma.upload.findFirst({
      where: {
        locationId: id,
        status: 'approved',
        locationVisibility: { not: 'hidden' }
      },
      orderBy: { createdAt: 'desc' },
      select: {
        locationVisibility: true,
        latitude: true,
        longitude: true,
        approximateLatitude: true,
        approximateLongitude: true
      }
    });

    const sanitizedLocation = { ...location };
    if (publicUpload && publicUpload.locationVisibility !== 'exact') {
      sanitizedLocation.address = null;
      if (publicUpload.locationVisibility === 'approximate') {
        sanitizedLocation.latitude = publicUpload.approximateLatitude ?? publicUpload.latitude;
        sanitizedLocation.longitude = publicUpload.approximateLongitude ?? publicUpload.longitude;
      } else if (publicUpload.locationVisibility === 'city') {
        const baseLat = publicUpload.latitude ?? publicUpload.approximateLatitude;
        const baseLng = publicUpload.longitude ?? publicUpload.approximateLongitude;
        sanitizedLocation.latitude = baseLat != null ? Math.round(baseLat * 10) / 10 : null;
        sanitizedLocation.longitude = baseLng != null ? Math.round(baseLng * 10) / 10 : null;
      }
    }
    const photosRaw = await prisma.upload.findMany({
      where: {
        locationId: id,
        status: 'approved',
        locationVisibility: { not: 'hidden' }
      },
      select: {
        id: true,
        fileUrl: true,
        fileType: true,
        latitude: true,
        longitude: true,
        approximateLatitude: true,
        approximateLongitude: true,
        locationVisibility: true,
        createdAt: true
      },
      orderBy: { createdAt: "desc" },
      take: 200
    });

    const photos = photosRaw.map((upload) => {
      if (upload.locationVisibility === 'exact') {
        return {
          id: upload.id,
          fileUrl: upload.fileUrl,
          fileType: upload.fileType,
          latitude: upload.latitude,
          longitude: upload.longitude,
          createdAt: upload.createdAt
        };
      }

      const baseLat = upload.latitude ?? upload.approximateLatitude;
      const baseLng = upload.longitude ?? upload.approximateLongitude;
      const coordinates = upload.locationVisibility === 'city'
        ? {
            latitude: baseLat != null ? Math.round(baseLat * 10) / 10 : null,
            longitude: baseLng != null ? Math.round(baseLng * 10) / 10 : null
          }
        : {
            latitude: upload.approximateLatitude ?? baseLat,
            longitude: upload.approximateLongitude ?? baseLng
          };

      return {
        id: upload.id,
        fileUrl: upload.fileUrl,
        fileType: upload.fileType,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        createdAt: upload.createdAt
      };
    });
    res.json({ location: sanitizedLocation, photos });
  } catch (error) {
    next(error);
  }
});

export default router;
