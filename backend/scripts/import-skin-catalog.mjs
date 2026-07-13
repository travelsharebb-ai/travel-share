import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const assetsRoot = path.resolve(process.cwd(), "public", "assets", "skins");
const catalog = [
  ["basic", "basic-modern-tiles.png", "Modern Tiles", 0],
  ["basic", "basic-sunset-hills.png", "Sunset Hills", 0],
  ["premium", "premium-photoroom-stylized.png", "Studio Portrait", 299],
  ["premium", "premium-forest-path.png", "Forest Path", 299],
  ["premium", "premium-abstract-watercolor.png", "Abstract Watercolor", 299],
  ["premium", "premium-mountain-range.png", "Mountain Range", 299],
  ["premium", "premium-tropical-beach.png", "Tropical Beach", 299],
  ["premium", "premium-studio-lighting.png", "Studio Lighting", 299],
  ["premium", "premium-coastal-sunset.png", "Coastal Sunset", 299],
  ["premium", "premium-night-sky.png", "Night Sky", 299],
  ["seasonal", "seasonal-minimalist-geometry.png", "Minimalist Geometry", 399],
  ["seasonal", "seasonal-cityscape-evening.png", "Cityscape Evening", 399]
];

try {
  for (const folder of ["basic", "premium", "seasonal", "pending-naming"]) {
    await fs.mkdir(path.join(assetsRoot, folder), { recursive: true });
  }
  const basicIds = [];
  for (const [category, filename, name, priceCents] of catalog) {
    await fs.access(path.join(assetsRoot, category, filename));
    const previewUrl = `/assets/skins/${category}/${filename}`;
    const metadata = { category, frameAssetUrl: previewUrl, previewImage: previewUrl, isPremium: priceCents > 0, unlockType: priceCents > 0 ? "purchase" : "included" };
    const existing = await prisma.purchaseItem.findFirst({ where: { type: "image_skin", previewUrl }, select: { id: true } });
    const item = existing
      ? await prisma.purchaseItem.update({ where: { id: existing.id }, data: { name, description: `${name} photo frame`, priceCents, active: true, metadata } })
      : await prisma.purchaseItem.create({ data: { name, description: `${name} photo frame`, type: "image_skin", priceCents, previewUrl, active: true, metadata } });
    if (category === "basic") basicIds.push(item.id);
  }
  if (basicIds.length !== 2) throw new Error(`Expected exactly two basic catalog entries; found ${basicIds.length}.`);
  const users = await prisma.user.findMany({ where: { role: { not: "guest" } }, select: { id: true } });
  for (const user of users) {
    for (const skinId of basicIds) {
      await prisma.userSkinUnlock.upsert({
        where: { userId_skinId: { userId: user.id, skinId } },
        update: {},
        create: { id: `${user.id}_${skinId}`, userId: user.id, skinId }
      });
    }
  }
  console.log(`Skin catalog imported: ${catalog.length} items; exactly 2 basic skins granted to ${users.length} registered users.`);
} finally {
  await prisma.$disconnect();
}
