import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();
const prisma = new PrismaClient();

async function loadSkinsFromPublic() {
  const skinsRoot = path.resolve(process.cwd(), 'public', 'assets', 'skins');
  const categories = await fs.readdir(skinsRoot, { withFileTypes: true }).catch(() => []);
  const created = [];

  for (const entry of categories) {
    if (!entry.isDirectory()) continue;
    const category = entry.name; // basic, premium, seasonal, etc.
    const dir = path.join(skinsRoot, category);
    const files = await fs.readdir(dir).catch(() => []);
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (!['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) continue;
      const sku = `${category}/${file}`;
      const name = file.replace(/[-_]+/g, ' ').replace(ext, '').replace(/\b(\w)/g, (m) => m.toUpperCase());
      const previewUrl = `/assets/skins/${category}/${file}`;
      const isBasic = category === 'basic' || category === 'pending-naming';
      const isPremium = category === 'premium' || category === 'seasonal';
      const priceCents = isBasic ? 0 : 199;

      const metadata = {
        category: isBasic ? 'basic' : isPremium ? 'premium' : category,
        frameAssetUrl: previewUrl,
        previewImage: previewUrl,
        isPremium: !isBasic,
        unlockType: isBasic ? 'included' : 'purchase',
        productionSlug: file.replace(ext, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
      };

      // Upsert by sku so seed is idempotent
      const item = await prisma.purchaseItem.upsert({
        where: { sku },
        update: {
          name,
          description: null,
          type: 'image_skin',
          priceCents,
          previewUrl,
          active: true,
          metadata
        },
        create: {
          sku,
          name,
          description: null,
          type: 'image_skin',
          priceCents,
          previewUrl,
          active: true,
          metadata
        }
      });
      created.push(item);
    }
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

  // Ensure at least one default purchase item exists (fallback)
  await prisma.purchaseItem.upsert({
    where: { sku: 'default/default-skin' },
    update: {
      name: 'Default Skin',
      type: 'image_skin',
      priceCents: 0,
      active: true,
      metadata: { category: 'basic', unlockType: 'included' }
    },
    create: {
      sku: 'default/default-skin',
      name: 'Default Skin',
      description: null,
      type: 'image_skin',
      priceCents: 0,
      previewUrl: '/assets/skins/basic/basic-modern-tiles.png',
      active: true,
      metadata: { category: 'basic', unlockType: 'included', previewImage: '/assets/skins/basic/basic-modern-tiles.png' }
    }
  });

  const skins = await loadSkinsFromPublic();
  // Ensure at least one public/live event exists for CI validation
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const qrTokenEnv = process.env.CI_QR_TOKEN || 'seed-event-1';
  // Idempotent upsert for a seeded public event. Use CI_QR_TOKEN when present.
  await prisma.event.upsert({
    where: { qrToken: qrTokenEnv },
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
      qrToken: qrTokenEnv,
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
