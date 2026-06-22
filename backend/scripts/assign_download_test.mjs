import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  const upload = await prisma.upload.findFirst();
  if (!upload) {
    throw new Error('No uploads found in the database to test against.');
  }

  let item = await prisma.purchaseItem.findFirst({ where: { type: 'download_asset' } });
  if (!item) {
    item = await prisma.purchaseItem.create({
      data: {
        name: 'Test download asset',
        description: 'Auto-created test asset',
        type: 'download_asset',
        priceCents: 0,
        active: false
      }
    });
  }

  const updated = await prisma.upload.update({ where: { id: upload.id }, data: { downloadPurchaseItemId: item.id } });

  const out = {
    uploadId: upload.id,
    itemId: item.id,
    updatedDownloadPurchaseItemId: updated.downloadPurchaseItemId
  };

  fs.writeFileSync('./backend/.assign_test_result.json', JSON.stringify(out, null, 2));
  console.log('Wrote result to backend/.assign_test_result.json');
}

main()
  .catch((err) => {
    console.error('Test script failed:', err?.message || err);
    fs.writeFileSync('./backend/.assign_test_error.txt', String(err?.stack || err));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
