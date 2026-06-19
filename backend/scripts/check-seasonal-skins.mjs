#!/usr/bin/env node
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();
const prisma = new PrismaClient();

const olds = [
  '/assets/skins/premium/premium-cityscape-evening.png',
  '/assets/skins/premium/premium-minimalist-geometry.png'
];
const news = [
  '/assets/skins/seasonal/seasonal-golden-city-evening.png',
  '/assets/skins/seasonal/seasonal-minimal-light-geometry.png'
];

async function run() {
  try {
    for (const o of olds) {
      const it = await prisma.purchaseItem.findFirst({ where: { metadata: { path: ['frameAssetUrl'], equals: o } } });
      console.log('Old path', o, '->', it ? `FOUND id=${it.id} name=${it.name}` : 'NOT FOUND');
    }
    for (const n of news) {
      const it = await prisma.purchaseItem.findFirst({ where: { metadata: { path: ['frameAssetUrl'], equals: n } } });
      console.log('New path', n, '->', it ? `FOUND id=${it.id} name=${it.name} category=${(it.metadata||{}).category}` : 'NOT FOUND');
    }
  } catch (err) {
    console.error('Check failed', err && err.message);
  } finally {
    await prisma.$disconnect();
  }
}

run();
