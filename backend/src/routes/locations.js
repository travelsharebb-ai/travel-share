import { Router } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma.js";

const router = Router();

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
    const where = {};
    if (req.query.userId) where.userId = String(req.query.userId);
    const items = await prisma.location.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        uploads: {
          where: {
            status: 'approved',
            locationVisibility: { not: 'hidden' }
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
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
            trip: {
              select: {
                id: true,
                title: true,
                user: { select: { id: true, name: true } }
              }
            },
            event: { select: { id: true, title: true } }
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
      const tripCount = location.uploads.filter((upload) => upload.tripId).length;
      const eventCount = location.uploads.filter((upload) => upload.eventId).length;
      const photoCount = location.uploads.length;

      const latest = Array.isArray(location.uploads) && location.uploads.length ? location.uploads[0] : null;
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
          photoCount
        },
        preview
      };
    });
    res.json({ locations: enriched });
  } catch (error) {
    next(error);
  }
});

// Get a single location and its photos
router.get("/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    const location = await prisma.location.findUnique({ where: { id } });
    if (!location) return res.status(404).json({ error: "Location not found." });
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
      where: { locationId: id },
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
