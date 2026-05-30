import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import { prisma } from "../utils/prisma.js";
import { uploadMedia } from "../utils/cloudinary.js";

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
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable()
});

router.get("/stats", async (_req, res) => {
  const [users, trips, uploads, reported] = await Promise.all([
    prisma.user.count(),
    prisma.trip.count(),
    prisma.upload.count(),
    prisma.upload.count({ where: { status: "reported" } })
  ]);
  res.json({ stats: { users, trips, uploads, reported } });
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
