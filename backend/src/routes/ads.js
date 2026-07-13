import { Router } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma.js";

const router = Router();

const querySchema = z.object({
  placement: z.string().optional()
});

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
    const ads = await prisma.internalAd.findMany({
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
    });
    res.json({ ads });
  } catch (err) {
    next(err);
  }
});

export default router;
