import { prisma } from "./prisma.js";

function isBasicSkin(skin) {
  const metadata = skin?.metadata && typeof skin.metadata === "object" ? skin.metadata : {};
  return skin?.type === "image_skin" && skin?.active !== false && (metadata.category === "basic" || skin.priceCents === 0);
}

export async function getBasicSkins(prismaClient = prisma) {
  const skins = await prismaClient.purchaseItem.findMany({
    where: { type: "image_skin", active: true },
    orderBy: { createdAt: "asc" }
  });
  return skins.filter(isBasicSkin).slice(0, 2);
}

export async function ensureBasicSkinUnlocks(userId, prismaClient = prisma) {
  if (!userId) return [];
  const basics = await getBasicSkins(prismaClient);
  for (const skin of basics) {
    await prismaClient.userSkinUnlock.upsert({
      where: { id: `${userId}_${skin.id}` },
      update: {},
      create: { id: `${userId}_${skin.id}`, userId, skinId: skin.id }
    });
  }
  return basics;
}

export async function userOwnsSkin(userId, skinId, prismaClient = prisma) {
  if (!userId || !skinId) return false;
  const skin = await prismaClient.purchaseItem.findUnique({ where: { id: skinId } });
  if (!skin || skin.type !== "image_skin" || skin.active === false) return false;
  if (isBasicSkin(skin)) {
    await ensureBasicSkinUnlocks(userId, prismaClient);
    return true;
  }
  const [unlock, purchase] = await Promise.all([
    prismaClient.userSkinUnlock.findFirst({ where: { userId, skinId } }),
    prismaClient.userPurchase.findUnique({ where: { userId_itemId: { userId, itemId: skinId } } }).catch(() => null)
  ]);
  return Boolean(unlock || purchase?.status === "owned");
}

// Attach frameAssetUrl and ensure skinId presence on upload objects.
// Accepts an array of uploads and an optional prisma client for testing.
export async function attachFrameUrls(uploads, prismaClient = prisma) {
  if (!Array.isArray(uploads) || uploads.length === 0) return uploads;
  const skinIds = Array.from(new Set(uploads.filter((u) => u && u.skinId).map((u) => u.skinId)));
  if (!skinIds.length) return uploads.map((u) => ({ ...u, skinId: u.skinId || null }));

  const skins = await prismaClient.purchaseItem.findMany({ where: { id: { in: skinIds } } });
  const map = Object.fromEntries(skins.map((s) => [s.id, s]));

  return uploads.map((u) => {
    if (!u) return u;
    const skin = u.skinId ? map[u.skinId] : null;
    return { ...u, skinId: u.skinId || null, frameAssetUrl: skin?.metadata?.frameAssetUrl || null };
  });
}

export default { attachFrameUrls, ensureBasicSkinUnlocks, getBasicSkins, userOwnsSkin };
