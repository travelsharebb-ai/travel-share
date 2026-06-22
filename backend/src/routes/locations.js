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
    const items = await prisma.location.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 });
    res.json({ locations: items });
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
    const photos = await prisma.upload.findMany({ where: { locationId: id }, select: { id: true, fileUrl: true, fileType: true, latitude: true, longitude: true, createdAt: true } , orderBy: { createdAt: "desc" }, take: 200 });
    res.json({ location, photos });
  } catch (error) {
    next(error);
  }
});

export default router;
