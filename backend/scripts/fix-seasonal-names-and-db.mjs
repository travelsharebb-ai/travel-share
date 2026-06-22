#!/usr/bin/env node
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

dotenv.config();
const prisma = new PrismaClient();

// Strict mapping (no heuristics) — only these inputs are handled
const mappings = [
  {
    oldFile: 'backend/public/assets/skins/premium/premium-cityscape-evening.png',
    finalFile: 'backend/public/assets/skins/seasonal/seasonal-cityscape-evening.png',
    finalWeb: '/assets/skins/seasonal/seasonal-cityscape-evening.png'
  },
  {
    oldFile: 'backend/public/assets/skins/premium/premium-minimalist-geometry.png',
    finalFile: 'backend/public/assets/skins/seasonal/seasonal-minimalist-geometry.png',
    finalWeb: '/assets/skins/seasonal/seasonal-minimalist-geometry.png'
  }
];

async function renameFiles() {
  for (const m of mappings) {
    // If final already exists, skip rename
    try {
      await fs.access(m.finalFile);
      console.log('Final file already exists:', m.finalFile);
      continue;
    } catch (e) {}

    // If old exists, move to final
    try {
      await fs.access(m.oldFile);
      // ensure dest dir
      await fs.mkdir(path.dirname(m.finalFile), { recursive: true });
      await fs.rename(m.oldFile, m.finalFile);
      console.log('Renamed', m.oldFile, '->', m.finalFile);
      // stage git move if repo present
      try { execSync(`git add -A && git mv --force ${m.oldFile} ${m.finalFile}`); } catch { /* ignore */ }
    } catch (err) {
      console.warn('Old file not found, skipping rename for', m.oldFile);
    }
  }
}

async function updateDb() {
  try {
    for (const m of mappings) {
      // Update any PurchaseItem rows whose metadata.frameAssetUrl exactly matches either
      // the original premium path OR the final path (covers prior intermediate runs).
      const candidates = [
        m.oldFile.replace(/^backend\/public/, '/assets'),
        m.finalWeb
      ];

      for (const cand of candidates) {
        // Use exact metadata path match
        const item = await prisma.purchaseItem.findFirst({ where: { metadata: { path: ['frameAssetUrl'], equals: cand } } });
        if (!item) {
          console.log('No PurchaseItem row matching frameAssetUrl =', cand);
          continue;
        }

        const newMeta = Object.assign({}, item.metadata || {}, {
          category: 'seasonal',
          isSeasonal: true,
          isPremium: false,
          frameAssetUrl: m.finalWeb
        });

        await prisma.purchaseItem.update({ where: { id: item.id }, data: { metadata: newMeta } });
        console.log('Updated PurchaseItem id=', item.id, 'frameAssetUrl ->', m.finalWeb);
      }
    }
  } catch (err) {
    console.error('DB update failed', err && err.message);
    process.exitCode = 1;
  }
}

async function verify() {
  console.log('\nVerification:');
  for (const m of mappings) {
    const exists = await fs.access(m.finalFile).then(() => true).catch(() => false);
    console.log('File', m.finalFile, exists ? 'EXISTS' : 'MISSING');
    const row = await prisma.purchaseItem.findFirst({ where: { metadata: { path: ['frameAssetUrl'], equals: m.finalWeb } } });
    console.log('DB row for', m.finalWeb, row ? `FOUND id=${row.id} name=${row.name}` : 'NOT FOUND');
  }
}

async function run() {
  try {
    await renameFiles();
    await updateDb();
    await verify();

    // If stripe key present, optionally run sync (leave to operator to decide)
    if (process.env.STRIPE_SECRET_KEY) {
      console.log('STRIPE_SECRET_KEY present: stripe sync can be run separately if desired.');
    } else {
      console.log('Stripe not configured: skipping external sync.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

run();
