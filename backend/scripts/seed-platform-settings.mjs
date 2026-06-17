import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const defaults = {
    guestAccessDays: '3',
    guestDeletionDays: '14',
    maxUploadSizeMb: '50',
    defaultPrivacy: 'approximate',
    moderationProvider: 'disabled',
    mapProvider: 'mapbox',
    paymentProvider: 'planned_stripe',
    backgroundVideoUrl: '/videos/come-to-barbados.mp4'
  };

  for (const [key, value] of Object.entries(defaults)) {
    await prisma.platformSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value }
    });
    console.log('Upserted', key, value);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
