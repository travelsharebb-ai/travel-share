import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { isBasicSkinRecord, skinCatalog } from "./skin-catalog.mjs";

const prisma = new PrismaClient();
const root = path.resolve(process.cwd(), "public", "assets", "skins");
const categories = ["basic", "premium", "seasonal", "pending-naming"];

function skinDiagnostic(skin) {
  const metadata = skin?.metadata && typeof skin.metadata === "object" ? skin.metadata : {};
  return {
    id: skin.id,
    name: skin.name,
    category: metadata.category || null,
    type: skin.type,
    active: skin.active,
    priceCents: skin.priceCents,
    assetPath: metadata.frameAssetUrl || metadata.previewImage || skin.previewUrl || null
  };
}

function failWithSkins(message, skins) {
  console.error(message);
  console.error("Relevant skin records:");
  for (const skin of skins) console.error(JSON.stringify(skinDiagnostic(skin)));
  throw new Error(message);
}

try {
  for (const category of categories) await fs.access(path.join(root, category));
  const skins = await prisma.purchaseItem.findMany({
    where: { type: "image_skin" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      sku: true,
      name: true,
      type: true,
      active: true,
      priceCents: true,
      previewUrl: true,
      metadata: true
    }
  });
  const catalogSkins = skins.filter((skin) => skinCatalog.some((entry) => entry.sku === skin.sku));
  if (catalogSkins.length !== skinCatalog.length) {
    failWithSkins(`Expected exactly ${skinCatalog.length} canonical catalog skins; found ${catalogSkins.length}.`, catalogSkins);
  }

  const invalidCatalogSkins = catalogSkins.filter((skin) => {
    const expected = skinCatalog.find((entry) => entry.sku === skin.sku);
    const metadata = skin.metadata && typeof skin.metadata === "object" ? skin.metadata : {};
    return skin.active !== true
      || skin.name !== expected.name
      || skin.priceCents !== expected.priceCents
      || skin.previewUrl !== expected.previewUrl
      || metadata.category !== expected.category;
  });
  if (invalidCatalogSkins.length) failWithSkins("Canonical skin fields do not match the intended catalog.", invalidCatalogSkins);

  const basic = skins.filter(isBasicSkinRecord);
  if (basic.length !== 2) failWithSkins(`Expected exactly 2 active basic skins; found ${basic.length}.`, basic);
  if (basic.some((skin) => !skin.previewUrl?.startsWith("/assets/skins/basic/"))) failWithSkins("Basic skin asset paths are invalid.", basic);

  const paidCatalogSkins = catalogSkins.filter((skin) => !basic.some((basicSkin) => basicSkin.id === skin.id));
  const invalidPaidSkins = paidCatalogSkins.filter((skin) => {
    const metadata = skin.metadata && typeof skin.metadata === "object" ? skin.metadata : {};
    return skin.priceCents <= 0 || metadata.isPremium !== true || metadata.unlockType !== "purchase";
  });
  if (invalidPaidSkins.length) failWithSkins("Premium/seasonal catalog skins must remain paid and purchase-locked.", invalidPaidSkins);

  const users = await prisma.user.findMany({ where: { role: { not: "guest" } }, select: { id: true } });
  for (const user of users) {
    const count = await prisma.userSkinUnlock.count({ where: { userId: user.id, skinId: { in: basic.map((skin) => skin.id) } } });
    if (count !== 2) throw new Error(`Registered user ${user.id} does not have exactly 2 basic skin unlocks.`);
  }
  console.log(`Skin catalog verified: ${catalogSkins.length} canonical skins, 2 active basic skins, ${paidCatalogSkins.length} paid skins and ${users.length} registered user unlock sets.`);
} finally {
  await prisma.$disconnect();
}
