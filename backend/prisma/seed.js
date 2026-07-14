import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { skinCatalog, skinMetadata } from '../scripts/skin-catalog.mjs';

dotenv.config();
const prisma = new PrismaClient();
const SEEDED_EVENT_QR_TOKEN = 'test-ci-token';

async function loadSkinsFromPublic() {
  const skinsRoot = path.resolve(process.cwd(), 'public', 'assets', 'skins');
  const created = [];

  for (const skin of skinCatalog) {
    await fs.access(path.join(skinsRoot, skin.category, skin.filename));
    const data = {
      name: skin.name,
      description: `${skin.name} photo frame`,
      type: 'image_skin',
      priceCents: skin.priceCents,
      previewUrl: skin.previewUrl,
      active: true,
      metadata: skinMetadata(skin)
    };
    const item = await prisma.purchaseItem.upsert({
      where: { sku: skin.sku },
      update: data,
      create: { sku: skin.sku, ...data }
    });
    created.push(item);
  }

  return created;
}

async function main() {
  // Create a minimal admin user for local/dev testing.
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: { name: 'Admin' },
    create: {
      name: 'Admin',
      email: 'admin@example.com',
      passwordHash: 'seeded-password-hash',
      role: 'platform_admin'
    }
  });

  // Retain the legacy fallback record without allowing it to become a third
  // active/free/basic skin or overwrite the canonical Modern Tiles product.
  await prisma.purchaseItem.upsert({
    where: { sku: 'default/default-skin' },
    update: {
      name: 'Modern Tiles',
      type: 'image_skin',
      priceCents: 0,
      previewUrl: '/assets/skins/basic/basic-modern-tiles.png',
      active: false,
      metadata: {
        category: 'legacy',
        frameAssetUrl: '/assets/skins/basic/basic-modern-tiles.png',
        previewImage: '/assets/skins/basic/basic-modern-tiles.png',
        isPremium: false,
        unlockType: 'included'
      }
    },
    create: {
      sku: 'default/default-skin',
      name: 'Modern Tiles',
      description: null,
      type: 'image_skin',
      priceCents: 0,
      previewUrl: '/assets/skins/basic/basic-modern-tiles.png',
      active: false,
      metadata: {
        category: 'legacy',
        frameAssetUrl: '/assets/skins/basic/basic-modern-tiles.png',
        previewImage: '/assets/skins/basic/basic-modern-tiles.png',
        isPremium: false,
        unlockType: 'included'
      }
    }
  });

  const skins = await loadSkinsFromPublic();
  // Ensure at least one public/live event exists for CI validation
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  // Idempotent upsert for a deterministic seeded public event.
  await prisma.event.upsert({
    where: { qrToken: SEEDED_EVENT_QR_TOKEN },
    update: {
      title: 'Demo Beach Festival',
      description: 'CI validation event',
      category: 'festival',
      location: 'Barbados',
      visibility: 'public',
      status: 'live',
      startDate: now,
      endDate: tomorrow,
      latitude: 13.0975,
      longitude: -59.6167
    },
    create: {
      title: 'Demo Beach Festival',
      description: 'CI validation event',
      category: 'festival',
      location: 'Barbados',
      visibility: 'public',
      status: 'live',
      qrToken: SEEDED_EVENT_QR_TOKEN,
      startDate: now,
      endDate: tomorrow,
      latitude: 13.0975,
      longitude: -59.6167
    }
  });
  console.log('Seed complete:', { adminId: admin.id, skinsSeeded: skins.length });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
