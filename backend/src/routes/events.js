import QRCode from "qrcode";
import { Router } from "express";
import { z } from "zod";
import { isPlatformAdmin } from "../middleware/auth.js";
import { prisma } from "../utils/prisma.js";
import { secureToken } from "../utils/tokens.js";
import crypto from "node:crypto";

const router = Router();

function eventWhere(req, id) {
  return isPlatformAdmin(req.user) ? { id } : { id, organizerId: req.user.id };
}

const eventSchema = z.object({
  title: z.string().min(2).max(140),
  description: z.string().max(1000).optional().nullable(),
  category: z.string().max(80).optional().nullable(),
  location: z.string().max(160).optional().nullable(),
  latitude: z.coerce.number().optional().nullable(),
  longitude: z.coerce.number().optional().nullable(),
  startDate: z.string(),
  endDate: z.string().optional().nullable(),
  visibility: z.enum(["public", "private", "unlisted"]).optional(),
  status: z.enum(["draft", "live", "ended", "archived"]).optional(),
  coverImageUrl: z.string().url().optional().nullable(),
  organizerId: z.string().optional().nullable()
});

const mapSchema = z.object({
  title: z.string().min(2).max(120),
  mapType: z.string().max(40).optional(),
  imageUrl: z.string().url().optional().nullable(),
  mapboxStyle: z.string().max(160).optional().nullable(),
  centerLat: z.coerce.number().optional().nullable(),
  centerLng: z.coerce.number().optional().nullable(),
  zoom: z.coerce.number().optional().nullable(),
  active: z.boolean().optional()
});

const zoneSchema = z.object({
  name: z.string().min(2).max(120),
  type: z.string().min(2).max(80),
  description: z.string().max(500).optional().nullable(),
  x: z.coerce.number().optional().nullable(),
  y: z.coerce.number().optional().nullable(),
  latitude: z.coerce.number().optional().nullable(),
  longitude: z.coerce.number().optional().nullable(),
  crowdStatus: z.enum(["low", "moderate", "high"]).optional(),
  displayOrder: z.coerce.number().int().optional()
});

router.get("/", async (req, res) => {
  const events = await prisma.event.findMany({
    where: isPlatformAdmin(req.user) ? {} : { organizerId: req.user.id },
    include: { _count: { select: { uploads: true, zones: true } } },
    orderBy: { startDate: "desc" }
  });
  res.json({ events });
});

router.post("/", async (req, res, next) => {
  try {
    const data = eventSchema.parse(req.body);
    const event = await prisma.event.create({
      data: {
        title: data.title,
        description: data.description || null,
        category: data.category || null,
        location: data.location || null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        visibility: data.visibility || "public",
        status: data.status || "draft",
        coverImageUrl: data.coverImageUrl || null,
        organizerId: isPlatformAdmin(req.user) ? data.organizerId || req.user.id : req.user.id,
        qrToken: crypto.randomBytes(16).toString("hex")
      }
    });
    res.status(201).json({ event });
  } catch (error) {
    next(error);
  }
});

router.get("/:eventId", async (req, res) => {
  const event = await prisma.event.findFirst({
    where: eventWhere(req, req.params.eventId),
    include: {
      maps: { orderBy: { updatedAt: "desc" } },
      zones: { orderBy: { displayOrder: "asc" }, include: { _count: { select: { uploads: true } } } },
      uploads: { orderBy: { createdAt: "desc" } },
      _count: { select: { uploads: true, zones: true } }
    }
  });
  if (!event) return res.status(404).json({ error: "Event not found." });
  res.json({ event });
});

router.patch("/:eventId", async (req, res, next) => {
  try {
    const data = eventSchema.partial().parse(req.body);
    const existing = await prisma.event.findFirst({ where: eventWhere(req, req.params.eventId) });
    if (!existing) return res.status(404).json({ error: "Event not found." });
    const event = await prisma.event.update({
      where: { id: existing.id },
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate === undefined ? undefined : data.endDate ? new Date(data.endDate) : null,
        organizerId: isPlatformAdmin(req.user) ? data.organizerId ?? undefined : undefined
      }
    });
    res.json({ event });
  } catch (error) {
    next(error);
  }
});

router.get("/:eventId/qr", async (req, res) => {
  const event = await prisma.event.findFirst({ where: eventWhere(req, req.params.eventId) });
  if (!event) return res.status(404).json({ error: "Event not found." });
  const scanUrl = `${process.env.FRONTEND_URL}/event/${event.qrToken}`;
  const dataUrl = await QRCode.toDataURL(scanUrl, { margin: 1, width: 720 });
  res.json({ scanUrl, dataUrl, event });
});

router.post("/:eventId/maps", async (req, res, next) => {
  try {
    const data = mapSchema.parse(req.body);
    // Validate provided mapboxStyle against platform whitelist or basic prefix
    if (data.mapboxStyle) {
      // prefer an explicit whitelist stored in platformSetting 'allowedMapboxStyles' (comma-separated)
      const setting = await prisma.platformSetting.findUnique({ where: { key: "allowedMapboxStyles" } }).catch(() => null);
      const allowed = setting?.value ? setting.value.split(",").map((s) => s.trim()).filter(Boolean) : null;
      if (allowed && allowed.length > 0) {
        if (!allowed.includes(data.mapboxStyle)) return res.status(400).json({ error: "mapboxStyle not allowed by platform settings." });
      } else {
        // Basic validation: ensure it looks like a mapbox style reference
        if (!data.mapboxStyle.startsWith("mapbox://styles/")) return res.status(400).json({ error: "mapboxStyle must start with 'mapbox://styles/' or be pre-approved." });
        // keep length and allowed chars enforced by zod already (max 160)
      }
    }
    const event = await prisma.event.findFirst({ where: eventWhere(req, req.params.eventId) });
    if (!event) return res.status(404).json({ error: "Event not found." });
    const map = await prisma.eventMap.create({
      data: { eventId: event.id, ...data, mapType: data.mapType || "image" }
    });
    res.status(201).json({ map });
  } catch (error) {
    next(error);
  }
});

router.post("/:eventId/zones", async (req, res, next) => {
  try {
    const data = zoneSchema.parse(req.body);
    const event = await prisma.event.findFirst({ where: eventWhere(req, req.params.eventId) });
    if (!event) return res.status(404).json({ error: "Event not found." });
    const zone = await prisma.mapZone.create({
      data: {
        eventId: event.id,
        ...data,
        crowdStatus: data.crowdStatus || "low",
        displayOrder: data.displayOrder || 0,
        qrToken: crypto.randomBytes(16).toString("hex")
      }
    });
    res.status(201).json({ zone });
  } catch (error) {
    next(error);
  }
});

router.patch("/:eventId/zones/:zoneId", async (req, res, next) => {
  try {
    const data = zoneSchema.partial().parse(req.body);
    const event = await prisma.event.findFirst({ where: eventWhere(req, req.params.eventId) });
    if (!event) return res.status(404).json({ error: "Event not found." });
    const zone = await prisma.mapZone.update({
      where: { id: req.params.zoneId },
      data
    });
    res.json({ zone });
  } catch (error) {
    next(error);
  }
});

router.get("/:eventId/analytics", async (req, res) => {
  const event = await prisma.event.findFirst({ where: eventWhere(req, req.params.eventId) });
  if (!event) return res.status(404).json({ error: "Event not found." });
  const [uploads, approved, pending, zones] = await Promise.all([
    prisma.upload.count({ where: { eventId: event.id } }),
    prisma.upload.count({ where: { eventId: event.id, status: "approved" } }),
    prisma.upload.count({ where: { eventId: event.id, status: "pending" } }),
    prisma.mapZone.findMany({
      where: { eventId: event.id },
      include: { _count: { select: { uploads: true } } },
      orderBy: { displayOrder: "asc" }
    })
  ]);
  res.json({
    analytics: {
      uploads,
      approved,
      pending,
      popularZones: zones.map((zone) => ({ id: zone.id, name: zone.name, count: zone._count.uploads, crowdStatus: zone.crowdStatus }))
    }
  });
});

export default router;
