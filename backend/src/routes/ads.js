import { Router } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma.js";
import { adInteractionLimiter } from "../middleware/rateLimits.js";

const router = Router();
const DEFAULT_ROTATION_MINUTES = 5;

function validRotationMinutes(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 1440 ? parsed : DEFAULT_ROTATION_MINUTES;
}

const querySchema = z.object({
  placement: z.enum(["global", "tourist", "event", "guest", "map", "upload_success"]).optional()
});

const interactionSchema = z.object({
  type: z.enum(["impression", "click"]),
  placement: z.enum(["global", "tourist", "event", "guest", "map", "upload_success"]),
  path: z.string().trim().min(1).max(256).refine((value) => value.startsWith("/"), "path must be an application pathname").transform((value) => value.split(/[?#]/, 1)[0])
}).strict();

router.get("/", async (req, res, next) => {
  try {
    const query = querySchema.parse(req.query);
    const now = new Date();
    const filters = {
      active: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }
      ]
    };
    if (query.placement) {
      filters.OR = [{ placement: query.placement }, { placement: "global" }];
    }
    const [ads, rotationSetting] = await Promise.all([
      prisma.internalAd.findMany({
        where: filters,
        orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
        take: 10,
        select: {
          id: true,
          title: true,
          description: true,
          mediaUrl: true,
          mediaType: true,
          linkUrl: true,
          placement: true,
          displaySeconds: true
        }
      }),
      prisma.platformSetting.findUnique({ where: { key: "adRotationMinutes" }, select: { value: true } })
    ]);
    res.json({ ads, rotationMinutes: validRotationMinutes(rotationSetting?.value) });
  } catch (err) {
    next(err);
  }
});

router.post("/:adId/interaction", adInteractionLimiter, async (req, res, next) => {
  try {
    const data = interactionSchema.parse(req.body || {});
    const now = new Date();
    const ad = await prisma.internalAd.findFirst({
      where: {
        id: req.params.adId,
        active: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }
        ]
      },
      select: { id: true }
    });
    if (!ad) return res.status(404).json({ error: "Ad is not available." });

    await prisma.adInteraction.create({
      data: {
        adId: ad.id,
        type: data.type,
        placement: data.placement,
        path: data.path
      },
      select: { id: true }
    });
    res.status(202).json({ accepted: true });
  } catch (error) {
    next(error);
  }
});

export default router;
