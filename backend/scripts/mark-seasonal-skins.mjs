#!/usr/bin/env node
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

dotenv.config();
const prisma = new PrismaClient();

const targets = [
  {
    oldPath: '/assets/skins/premium/premium-cityscape-evening.png',
    newPath: '/assets/skins/seasonal/seasonal-golden-city-evening.png'
  },
  {
    oldPath: '/assets/skins/premium/premium-minimalist-geometry.png',
    newPath: '/assets/skins/seasonal/seasonal-minimal-light-geometry.png'
  }
];

async function run() {
  try {
    console.log('Marking specified skins as seasonal...');

    for (const t of targets) {
      console.log('Looking for PurchaseItem with frameAssetUrl =', t.oldPath);
      const item = await prisma.purchaseItem.findFirst({ where: { metadata: { path: ['frameAssetUrl'], equals: t.oldPath } } });
      if (!item) {
        console.warn('No PurchaseItem found for', t.oldPath, '- skipping update.');
        continue;
      }

      const newMeta = Object.assign({}, item.metadata || {}, {
        category: 'seasonal',
        isSeasonal: true,
        isPremium: false,
        frameAssetUrl: t.newPath
      });

      await prisma.purchaseItem.update({ where: { id: item.id }, data: { metadata: newMeta, active: true } });
      console.log('Updated PurchaseItem', item.id, '->', t.newPath);
    }

    // If Stripe is configured, run product sync to ensure Stripe mappings exist for these items
    if (process.env.STRIPE_SECRET_KEY) {
      console.log('STRIPE_SECRET_KEY detected — running Stripe product sync script.');
      try {
        execSync('node scripts/sync-stripe-products.mjs', { stdio: 'inherit' });
      } catch (err) {
        console.warn('Stripe sync script failed', err && err.message);
      }
    } else {
      console.log('No STRIPE_SECRET_KEY — skipping Stripe sync.');
    }

    console.log('Done.');
  } catch (err) {
    console.error('Error marking skins seasonal:', err && err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();
