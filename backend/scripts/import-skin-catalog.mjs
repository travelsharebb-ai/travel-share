import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { isBasicSkinRecord, skinCatalog, skinMetadata } from "./skin-catalog.mjs";

const prisma = new PrismaClient();
const assetsRoot = path.resolve(process.cwd(), "public", "assets", "skins");

try {
  for (const folder of ["basic", "premium", "seasonal", "pending-naming"]) {
    await fs.mkdir(path.join(assetsRoot, folder), { recursive: true });
  }
  const basicIds = [];
  for (const skin of skinCatalog) {
    await fs.access(path.join(assetsRoot, skin.category, skin.filename));
    const item = await prisma.purchaseItem.upsert({
      where: { sku: skin.sku },
      update: {
        name: skin.name,
        description: `${skin.name} photo frame`,
        type: "image_skin",
        priceCents: skin.priceCents,
        previewUrl: skin.previewUrl,
        active: true,
        metadata: skinMetadata(skin)
      },
      create: {
        sku: skin.sku,
        name: skin.name,
        description: `${skin.name} photo frame`,
        type: "image_skin",
        priceCents: skin.priceCents,
        previewUrl: skin.previewUrl,
        active: true,
        metadata: skinMetadata(skin)
      }
    });
    if (skin.category === "basic") basicIds.push(item.id);
  }
  if (basicIds.length !== 2) throw new Error(`Expected exactly two basic catalog entries; found ${basicIds.length}.`);

  const activeSkins = await prisma.purchaseItem.findMany({
    where: { type: "image_skin", active: true },
    select: { id: true, type: true, active: true, priceCents: true, metadata: true }
  });
  const extraBasicIds = activeSkins
    .filter((skin) => isBasicSkinRecord(skin) && !basicIds.includes(skin.id))
    .map((skin) => skin.id);
  if (extraBasicIds.length) {
    await prisma.purchaseItem.updateMany({
      where: { id: { in: extraBasicIds } },
      data: { active: false }
    });
  }

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
  console.log(`Skin catalog imported: ${skinCatalog.length} items; exactly 2 basic skins granted to ${users.length} registered users; ${extraBasicIds.length} stale/extra basic skins deactivated.`);
} finally {
  await prisma.$disconnect();
}
