import QRCode from "qrcode";
import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma.js";
import { secureToken } from "../utils/tokens.js";

const router = Router();

const tripSchema = z.object({
  title: z.string().min(2).max(120),
  destination: z.string().min(2).max(120),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  qrExpiresAt: z.string().optional().nullable()
});

router.get("/", async (req, res) => {
  const trips = await prisma.trip.findMany({
    where: { userId: req.user.id },
    include: { _count: { select: { uploads: true } } },
    orderBy: { createdAt: "desc" }
  });
  res.json({ trips });
});

router.post("/", async (req, res, next) => {
  try {
    const data = tripSchema.parse(req.body);
    const trip = await prisma.trip.create({
      data: {
        userId: req.user.id,
        title: data.title,
        destination: data.destination,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        qrExpiresAt: data.qrExpiresAt ? new Date(data.qrExpiresAt) : null,
        qrToken: secureToken(24)
      }
    });
    res.status(201).json({ trip });
  } catch (error) {
    next(error);
  }
});

router.get("/:tripId", async (req, res) => {
  const trip = await prisma.trip.findFirst({
    where: { id: req.params.tripId, userId: req.user.id },
    include: {
      uploads: { orderBy: { createdAt: "desc" } },
      shareLinks: { orderBy: { createdAt: "desc" } },
      _count: { select: { uploads: true } }
    }
  });
  if (!trip) return res.status(404).json({ error: "Trip not found." });
  res.json({ trip });
});

router.get("/:tripId/qr", async (req, res) => {
  const trip = await prisma.trip.findFirst({ where: { id: req.params.tripId, userId: req.user.id } });
  if (!trip) return res.status(404).json({ error: "Trip not found." });

  const scanUrl = `${process.env.FRONTEND_URL}/qr/${trip.qrToken}`;
  const dataUrl = await QRCode.toDataURL(scanUrl, { margin: 1, width: 720 });
  res.json({ scanUrl, dataUrl, trip });
});

router.patch("/:tripId/qr-settings", async (req, res, next) => {
  try {
    const schema = z.object({
      qrActive: z.boolean().optional(),
      qrMode: z.enum(["open", "paused", "expired", "revoked"]).optional(),
      qrExpiresAt: z.string().nullable().optional(),
      regenerate: z.boolean().optional()
    });
    const data = schema.parse(req.body);

    const trip = await prisma.trip.findFirst({ where: { id: req.params.tripId, userId: req.user.id } });
    if (!trip) return res.status(404).json({ error: "Trip not found." });

    const updated = await prisma.trip.update({
      where: { id: trip.id },
      data: {
        qrActive: data.qrActive ?? undefined,
        qrMode: data.qrMode ?? undefined,
        qrExpiresAt: data.qrExpiresAt === undefined ? undefined : data.qrExpiresAt ? new Date(data.qrExpiresAt) : null,
        qrToken: data.regenerate ? secureToken(24) : undefined
      }
    });

    res.json({ trip: updated });
  } catch (error) {
    next(error);
  }
});

router.post("/:tripId/share-links", async (req, res, next) => {
  try {
    const schema = z.object({ pin: z.string().min(4).max(24).optional().nullable() });
    const data = schema.parse(req.body);
    const trip = await prisma.trip.findFirst({ where: { id: req.params.tripId, userId: req.user.id } });
    if (!trip) return res.status(404).json({ error: "Trip not found." });

    const shareLink = await prisma.shareLink.create({
      data: {
        tripId: trip.id,
        token: secureToken(24),
        pinHash: data.pin ? await bcrypt.hash(data.pin, 12) : null
      }
    });

    res.status(201).json({ shareLink, url: `${process.env.FRONTEND_URL}/share/${shareLink.token}` });
  } catch (error) {
    next(error);
  }
});

export default router;
