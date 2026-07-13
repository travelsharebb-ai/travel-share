import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const root = path.resolve(process.cwd(), "public", "assets", "skins");
const categories = ["basic", "premium", "seasonal", "pending-naming"];

try {
  for (const category of categories) await fs.access(path.join(root, category));
  const basic = await prisma.purchaseItem.findMany({
    where: { type: "image_skin", active: true, priceCents: 0 },
    orderBy: { createdAt: "asc" },
    take: 3,
    select: { id: true, previewUrl: true }
  });
  if (basic.length !== 2) throw new Error(`Expected exactly 2 active basic skins; found ${basic.length}.`);
  if (basic.some((skin) => !skin.previewUrl?.startsWith("/assets/skins/basic/"))) throw new Error("Basic skin asset paths are invalid.");
  const users = await prisma.user.findMany({ where: { role: { not: "guest" } }, select: { id: true } });
  for (const user of users) {
    const count = await prisma.userSkinUnlock.count({ where: { userId: user.id, skinId: { in: basic.map((skin) => skin.id) } } });
    if (count !== 2) throw new Error(`Registered user ${user.id} does not have exactly 2 basic skin unlocks.`);
  }
  console.log(`Skin catalog verified: 2 basic skins and ${users.length} registered user unlock sets.`);
} finally {
  await prisma.$disconnect();
}
