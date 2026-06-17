import { prisma } from "./prisma.js";

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

export default { attachFrameUrls };
