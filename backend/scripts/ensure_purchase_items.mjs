import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import {PrismaClient} from '@prisma/client';

const prisma = new PrismaClient();
const outDir = path.join(process.cwd(), 'tmp');
const outFile = path.join(outDir, 'purchase_items_post.json');

const items = [
  { file: '/assets/skins/basic/basic-modern-tiles.png', name: 'Modern Tiles', category: 'basic', priceCents: 0 },
  { file: '/assets/skins/basic/basic-sunset-hills.png', name: 'Sunset Hills', category: 'basic', priceCents: 0 },
  { file: '/assets/skins/premium/premium-abstract-watercolor.png', name: 'Abstract Watercolor', category: 'premium', priceCents: 299 },
  { file: '/assets/skins/premium/premium-coastal-sunset.png', name: 'Coastal Sunset', category: 'premium', priceCents: 299 },
  { file: '/assets/skins/premium/premium-forest-path.png', name: 'Forest Path', category: 'premium', priceCents: 299 },
  { file: '/assets/skins/premium/premium-mountain-range.png', name: 'Mountain Range', category: 'premium', priceCents: 299 },
  { file: '/assets/skins/premium/premium-night-sky.png', name: 'Night Sky', category: 'premium', priceCents: 299 },
  { file: '/assets/skins/premium/premium-photoroom-stylized.png', name: 'Photoroom Stylized', category: 'premium', priceCents: 299 },
  { file: '/assets/skins/premium/premium-studio-lighting.png', name: 'Studio Lighting', category: 'premium', priceCents: 299 },
  { file: '/assets/skins/premium/premium-tropical-beach.png', name: 'Tropical Beach', category: 'premium', priceCents: 299 },
  { file: '/assets/skins/seasonal/seasonal-cityscape-evening.png', name: 'Cityscape Evening', category: 'seasonal', priceCents: 0 },
  { file: '/assets/skins/seasonal/seasonal-minimalist-geometry.png', name: 'Minimalist Geometry', category: 'seasonal', priceCents: 0 }
];

function makeMetadata(entry){
  return {
    frameAssetUrl: entry.file,
    previewImage: entry.file,
    category: entry.category,
    isPremium: entry.category !== 'basic',
    isSeasonal: entry.category === 'seasonal'
  };
}

async function upsertEntry(entry){
  // Try find by exact previewUrl or by name
  const preview = entry.file;
  let existing = await prisma.purchaseItem.findFirst({ where: { OR: [{ previewUrl: preview }, { name: entry.name }] } });
  const data = {
    name: entry.name,
    description: `Frame overlay: ${entry.name}`,
    type: 'image_skin',
    priceCents: Number(entry.priceCents || 0),
    previewUrl: preview,
    active: true,
    metadata: makeMetadata(entry)
  };

  if (existing) {
    const updated = await prisma.purchaseItem.update({ where: { id: existing.id }, data });
    return { action: 'updated', id: updated.id, name: updated.name };
  } else {
    const created = await prisma.purchaseItem.create({ data });
    return { action: 'created', id: created.id, name: created.name };
  }
}

async function main(){
  try{
    const count = await prisma.purchaseItem.count();
    console.log('Existing PurchaseItem count =', count);
    if (count === 0) {
      console.log('Table empty — creating 12 purchase items...');
    }

    const results = [];
    for (const it of items){
      const res = await upsertEntry(it);
      console.log(res.action.toUpperCase(), res.id, res.name);
      results.push(res);
    }

    // Write snapshot
    const snapshot = await prisma.purchaseItem.findMany({ orderBy: { createdAt: 'asc' } });
    await fs.promises.mkdir(outDir, { recursive: true });
    await fs.promises.writeFile(outFile, JSON.stringify(snapshot, null, 2));
    console.log('WROTE', outFile);

    // Print counts by category
    const byCat = {};
    for (const s of snapshot){
      const cat = s.metadata?.category || 'unknown';
      byCat[cat] = (byCat[cat] || 0) + 1;
    }
    console.log('Category counts:', JSON.stringify(byCat));
    console.log('Total purchase items:', snapshot.length);
  }catch(err){
    console.error('ERROR', err && err.message || err);
    process.exitCode = 2;
  }finally{
    await prisma.$disconnect();
  }
}

main();
