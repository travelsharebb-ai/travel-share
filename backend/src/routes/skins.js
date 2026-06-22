import { Router } from "express";
import { prisma } from "../utils/prisma.js";
import { isPlatformAdmin } from "../middleware/auth.js";

const router = Router();

function slugify(value) {
  return String(value || "travel-frame")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "travel-frame";
}

function inferSkinName(body) {
  const source = `${body.name || ""} ${body.description || ""} ${body.previewUrl || ""} ${body.metadata?.frameAssetUrl || ""}`.toLowerCase();
  if (body.name && !/^unnamed/i.test(body.name)) return body.name;
  if (source.includes("tropical") || source.includes("beach") || source.includes("island")) return "Tropical Glow Frame";
  if (source.includes("cinematic") || source.includes("night") || source.includes("dark")) return "Night Cinematic Frame";
  if (source.includes("polaroid") || source.includes("retro")) return "Retro Memory Frame";
  if (source.includes("vintage") || source.includes("stamp") || source.includes("passport")) return "Vintage Travel Stamp Frame";
  return "Travel Memory Frame";
}

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
  const name = inferSkinName(body);
  const category = body.metadata?.category || (Number(body.priceCents || 0) > 0 ? "premium" : "basic");
  const frameAssetUrl = body.metadata?.frameAssetUrl || body.frameAssetUrl || body.previewUrl || null;
  const data = {
    name,
    description: body.description || null,
    type: "image_skin",
    priceCents: Number(body.priceCents || 0),
    previewUrl: body.previewUrl || null,
    active: body.active === undefined ? true : !!body.active,
    metadata: {
      ...(body.metadata || {}),
      category,
      frameAssetUrl,
      previewImage: body.previewImage || body.previewUrl || frameAssetUrl,
      isPremium: category !== "basic",
      unlockType: category === "basic" ? "included" : "purchase",
      productionSlug: slugify(name),
      tags: Array.isArray(body.tags) ? body.tags : body.metadata?.tags || []
    }
  };
  const item = await prisma.purchaseItem.create({ data });
  res.status(201).json({ skin: item });
});

export default router;
