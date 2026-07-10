import { Router } from "express";
import { prisma } from "../utils/prisma.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const follows = await prisma.userFollow.findMany({
      where: { followerId: req.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        following: {
          select: { id: true, name: true, role: true }
        }
      }
    });
    res.json({ follows });
  } catch (error) {
    next(error);
  }
});

router.post("/:userId", async (req, res, next) => {
  try {
    const followingId = req.params.userId;
    if (followingId === req.user.id) {
      return res.status(400).json({ error: "You cannot follow yourself." });
    }

    const target = await prisma.user.findUnique({
      where: { id: followingId },
      select: { id: true, name: true, role: true }
    });
    if (!target) return res.status(404).json({ error: "User not found." });

    const follow = await prisma.userFollow.upsert({
      where: { followerId_followingId: { followerId: req.user.id, followingId } },
      update: {},
      create: { followerId: req.user.id, followingId },
      include: {
        following: {
          select: { id: true, name: true, role: true }
        }
      }
    });
    res.status(201).json({ follow });
  } catch (error) {
    next(error);
  }
});

router.delete("/:userId", async (req, res, next) => {
  try {
    await prisma.userFollow.deleteMany({
      where: { followerId: req.user.id, followingId: req.params.userId }
    });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
