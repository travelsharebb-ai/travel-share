import fs from 'fs/promises';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Map keywords to names
const styleNames = [
  'Tropical Glow Frame',
  'Night Cinematic Frame',
  'Retro Memory Frame',
  'Vintage Travel Stamp Frame',
  'Sunset Aura Frame',
  'Coastal Polaroid Frame',
  'Island Breeze Frame',
  'Classic White Border Frame',
  'Golden Hour Frame',
  'Festival Neon Frame',
  'Passport Stamp Frame',
  'Holiday Film Frame'
];

async function findSourceFiles(sourceFolder) {
  const entries = await fs.readdir(sourceFolder, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /\.(png|webp|jpe?g)$/i.test(entry.name))
    .filter((entry) => /chatgpt|skin|frame|image/i.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
}

async function guessName(filename, index) {
  const lower = filename.toLowerCase();
  if (lower.includes('tropical')) return 'Tropical Glow Frame';
  if (lower.includes('cinem')) return 'Night Cinematic Frame';
  if (lower.includes('polaroid') || lower.includes('retro')) return 'Retro Memory Frame';
  if (lower.includes('vintage')) return 'Vintage Travel Stamp Frame';
  // fallback to styleNames rotation
  return styleNames[index % styleNames.length];
}

async function categorize(filename, index) {
  // First two are 'basic'
  if (index < 2) return 'basic';
  return 'premium';
}

function slugify(value) {
  return String(value || 'travel-frame')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'travel-frame';
}

async function main() {
  const repoRoot = path.resolve(process.cwd());
  const frontendPublic = path.join(repoRoot, 'frontend', 'public');
  const destRoot = path.join(repoRoot, 'backend', 'public', 'assets', 'skins');
  await fs.mkdir(destRoot, { recursive: true });
  await Promise.all(['basic', 'premium', 'seasonal', 'pending-naming'].map((dir) => fs.mkdir(path.join(destRoot, dir), { recursive: true })));

  const created = [];

  const sourceFiles = await findSourceFiles(frontendPublic);
  for (let i = 0; i < sourceFiles.length; i++) {
    const fname = sourceFiles[i];
    const src = path.join(frontendPublic, fname);
    try {
      await fs.access(src);
    } catch (e) {
      console.warn('Source file missing:', src);
      continue;
    }

    const cat = await categorize(fname, i);
    const destDir = path.join(destRoot, cat);
    await fs.mkdir(destDir, { recursive: true });
    const name = await guessName(fname, i);
    const destName = `${cat}-${slugify(name)}.png`;
    const dest = path.join(destDir, destName);
    await fs.copyFile(src, dest);

    const frameAssetUrl = `/assets/skins/${cat}/${destName}`;
    const previewImage = frameAssetUrl;

    const isPremium = cat !== 'basic';
    const priceCents = isPremium ? 299 : 0; // basic free, premium $2.99
    const tags = name.toLowerCase().replace(' frame', '').split(/\s+/).filter(Boolean);
    const metadata = {
      frameAssetUrl,
      previewImage,
      category: cat,
      isPremium,
      unlockType: isPremium ? 'purchase' : 'included',
      tags
    };

    // prisma.purchaseItem.upsert requires a unique identifier in `where`.
    // Use findFirst -> update/create to support previewUrl which is not unique in schema.
    let item = await prisma.purchaseItem.findFirst({ where: { previewUrl: previewImage } });
    if (item) {
      item = await prisma.purchaseItem.update({ where: { id: item.id }, data: { name, description: `Frame overlay: ${name}`, priceCents, active: true, metadata } });
    } else {
      item = await prisma.purchaseItem.create({ data: { name, description: `Frame overlay: ${name}`, type: 'image_skin', priceCents, previewUrl: previewImage, active: true, metadata } });
    }

    created.push(item);
  }

  console.log('Imported skins:', created.map((c) => ({ id: c.id, name: c.name, preview: c.previewUrl })));

  // Grant 2 basic skins to every registered user (tourist, organizer, admin, platform_admin)
  const users = await prisma.user.findMany({ where: { role: { not: 'guest' } } });
  const basicSkins = await prisma.purchaseItem.findMany({ where: { type: 'image_skin' }, orderBy: { createdAt: 'asc' } });
  const basics = basicSkins.filter((s) => (s.metadata && s.metadata.frameAssetUrl && s.previewUrl && s.priceCents === 0)).slice(0, 2);
  for (const user of users) {
    for (const skin of basics) {
      await prisma.userSkinUnlock.upsert({
        where: { id: `${user.id}_${skin.id}` },
        update: {},
        create: { id: `${user.id}_${skin.id}`, userId: user.id, skinId: skin.id }
      }).catch(() => {});
    }
  }

  console.log('Granted basic skins to users');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
