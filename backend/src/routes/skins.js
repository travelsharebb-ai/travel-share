import { Router } from "express";
import { prisma } from "../utils/prisma.js";
import { isPlatformAdmin } from "../middleware/auth.js";

const router = Router();

// Public: list skins (PurchaseItems with type = image_skin)
router.get("/", async (req, res) => {
  const items = await prisma.purchaseItem.findMany({
    where: { type: "image_skin" },
    orderBy: { createdAt: "desc" }
  });
  res.json({ skins: items });
});

router.get("/:skinId", async (req, res) => {
  const item = await prisma.purchaseItem.findUnique({ where: { id: req.params.skinId } });
  if (!item) return res.status(404).json({ error: "Skin not found" });
  res.json({ skin: item });
});

// Admin: create/upload a skin (expects metadata.frameAssetUrl to point to /assets/...)
router.post("/", isPlatformAdmin, async (req, res) => {
  const body = req.body || {};
  const data = {
    name: body.name || "Unnamed Skin",
    description: body.description || null,
    type: "image_skin",
    priceCents: Number(body.priceCents || 0),
    previewUrl: body.previewUrl || null,
    active: body.active === undefined ? true : !!body.active,
    metadata: body.metadata || {}
  };
  const item = await prisma.purchaseItem.create({ data });
  res.status(201).json({ skin: item });
});

export default router;
