import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();
const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');
const ALLOW_DEMO_DATA = process.env.ALLOW_DEMO_DATA === 'true';
const CONFIRM_DEMO_RESET = process.env.CONFIRM_DEMO_RESET === 'I_UNDERSTAND_THIS_DELETES_DEMO_DATA';
const NODE_ENV = process.env.NODE_ENV || 'development';
const DATABASE_URL = process.env.DATABASE_URL || '';
const productionGuard = NODE_ENV === 'production' || /prod|production|live/.test(DATABASE_URL.toLowerCase());

const DEMO_EMAIL_DOMAIN = '@demo.travelshare.local';
const DEMO_PREFIX = '[DEMO]';
const DEMO_TOKEN_PREFIX = 'demo-';
const DEMO_MARKER = 'DEMO_SEED';

function print(...messages) {
  if (dryRun) {
    console.log('[dry-run]', ...messages);
    return;
  }
  console.log(...messages);
}

function safetyCheck() {
  if (!productionGuard) return;
  if (ALLOW_DEMO_DATA && CONFIRM_DEMO_RESET) return;
  console.error('Refusing to run demo clear script in production-like environment without both ALLOW_DEMO_DATA=true and CONFIRM_DEMO_RESET=I_UNDERSTAND_THIS_DELETES_DEMO_DATA');
  process.exit(1);
}

async function countOrDelete(model, where, label) {
  if (dryRun) {
    const count = await prisma[model].count({ where });
    print(`Would delete ${count} ${label}`);
    return count;
  }
  const result = await prisma[model].deleteMany({ where });
  print(`Deleted ${result.count} ${label}`);
  return result.count;
}

function hasItems(list) {
  return Array.isArray(list) && list.length > 0;
}

async function getIds(model, where) {
  const records = await prisma[model].findMany({ where, select: { id: true } });
  return records.map((item) => item.id);
}

async function main() {
  safetyCheck();
  print('Demo data clear started');

  const demoUserIds = await getIds('user', { email: { endsWith: DEMO_EMAIL_DOMAIN } });
  const demoItemIds = await getIds('purchaseItem', {
    OR: [
      { sku: { startsWith: 'demo/' } },
      { name: { startsWith: DEMO_PREFIX } }
    ]
  });
  const demoTripIds = await getIds('trip', {
    OR: [
      { title: { startsWith: DEMO_PREFIX } },
      { qrToken: { startsWith: DEMO_TOKEN_PREFIX } }
    ]
  });
  const demoEventIds = await getIds('event', {
    OR: [
      { title: { startsWith: DEMO_PREFIX } },
      { qrToken: { startsWith: DEMO_TOKEN_PREFIX } },
      { description: { contains: DEMO_MARKER } }
    ]
  });
  const demoLocationIds = await getIds('location', {
    OR: [
      { name: { startsWith: DEMO_PREFIX } },
      { userId: { in: demoUserIds } }
    ]
  });
  const demoGuestSessionIds = await getIds('guestSession', {
    OR: [
      { token: { startsWith: DEMO_TOKEN_PREFIX } },
      { displayName: { startsWith: DEMO_PREFIX } },
      { scopeId: { contains: 'demo' } }
    ]
  });
  const demoUploadIds = await getIds('upload', {
    OR: [
      { caption: { contains: DEMO_MARKER } },
      { uploaderAnonId: { startsWith: DEMO_TOKEN_PREFIX } },
      { fileUrl: { contains: 'demo.travelshare.local' } },
      { locationName: { contains: DEMO_PREFIX } },
      { tripId: { in: demoTripIds } },
      { eventId: { in: demoEventIds } },
      { guestSessionId: { in: demoGuestSessionIds } }
    ]
  });
  const demoQrSpaceIds = await getIds('qRUploadSpace', {
    OR: [
      { token: { startsWith: DEMO_TOKEN_PREFIX } },
      { title: { startsWith: DEMO_PREFIX } },
      { locationName: { contains: DEMO_PREFIX } }
    ]
  });

  await countOrDelete('adminModerationLog', { uploadId: { in: demoUploadIds } }, 'admin moderation logs');
  await countOrDelete('emailNotificationLog', {
    OR: [
      { uploadId: { in: demoUploadIds } },
      { userId: { in: demoUserIds } },
      { toEmail: { endsWith: DEMO_EMAIL_DOMAIN } }
    ]
  }, 'email notification logs');
  await countOrDelete('downloadAuditLog', {
    OR: [
      { uploadId: { in: demoUploadIds } },
      { userId: { in: demoUserIds } }
    ]
  }, 'download audit logs');

  await countOrDelete('paymentWebhookEvent', {
    OR: [
      { providerEventId: { startsWith: DEMO_TOKEN_PREFIX } },
      { transactionId: { in: await getIds('paymentTransaction', { userId: { in: demoUserIds } }) } }
    ]
  }, 'payment webhook events');

  await countOrDelete('userPurchase', {
    OR: [
      { userId: { in: demoUserIds } },
      { itemId: { in: demoItemIds } }
    ]
  }, 'user purchases');

  await countOrDelete('paymentTransaction', {
    OR: [
      { userId: { in: demoUserIds } },
      { itemId: { in: demoItemIds } },
      { providerRef: { startsWith: DEMO_TOKEN_PREFIX } }
    ]
  }, 'payment transactions');

  await countOrDelete('userSkinUnlock', {
    OR: [
      { userId: { in: demoUserIds } },
      { skinId: { in: demoItemIds } }
    ]
  }, 'user skin unlocks');

  await countOrDelete('shareLink', {
    OR: [
      { token: { startsWith: DEMO_TOKEN_PREFIX } },
      { tripId: { in: demoTripIds } },
      { eventId: { in: demoEventIds } }
    ]
  }, 'share links');

  await countOrDelete('blockedUploader', { tripId: { in: demoTripIds } }, 'blocked uploaders');
  await countOrDelete('tripChapter', { tripId: { in: demoTripIds } }, 'trip chapters');
  await countOrDelete('eventMap', { eventId: { in: demoEventIds } }, 'event maps');
  await countOrDelete('mapZone', { eventId: { in: demoEventIds } }, 'event zones');

  await countOrDelete('upload', {
    OR: [
      { id: { in: demoUploadIds } },
      { caption: { contains: DEMO_MARKER } },
      { uploaderAnonId: { startsWith: DEMO_TOKEN_PREFIX } },
      { fileUrl: { contains: 'demo.travelshare.local' } },
      { tripId: { in: demoTripIds } },
      { eventId: { in: demoEventIds } },
      { guestSessionId: { in: demoGuestSessionIds } }
    ]
  }, 'uploads');

  await countOrDelete('qRUploadSpace', {
    OR: [
      { id: { in: demoQrSpaceIds } },
      { token: { startsWith: DEMO_TOKEN_PREFIX } },
      { title: { startsWith: DEMO_PREFIX } },
      { locationName: { contains: DEMO_PREFIX } }
    ]
  }, 'QR upload spaces');

  await countOrDelete('notification', {
    OR: [
      { userId: { in: demoUserIds } },
      { title: { contains: DEMO_PREFIX } },
      { message: { contains: DEMO_MARKER } }
    ]
  }, 'notifications');

  await countOrDelete('userPreference', { userId: { in: demoUserIds } }, 'user preferences');
  await countOrDelete('location', {
    OR: [
      { id: { in: demoLocationIds } },
      { name: { startsWith: DEMO_PREFIX } },
      { userId: { in: demoUserIds } }
    ]
  }, 'locations');

  await countOrDelete('internalAd', { title: { startsWith: DEMO_PREFIX } }, 'internal ads');

  await countOrDelete('guestSession', {
    OR: [
      { id: { in: demoGuestSessionIds } },
      { token: { startsWith: DEMO_TOKEN_PREFIX } },
      { displayName: { startsWith: DEMO_PREFIX } },
      { scopeId: { contains: 'demo' } }
    ]
  }, 'guest sessions');

  await countOrDelete('event', {
    OR: [
      { id: { in: demoEventIds } },
      { title: { startsWith: DEMO_PREFIX } },
      { qrToken: { startsWith: DEMO_TOKEN_PREFIX } },
      { description: { contains: DEMO_MARKER } }
    ]
  }, 'events');

  await countOrDelete('trip', {
    OR: [
      { id: { in: demoTripIds } },
      { title: { startsWith: DEMO_PREFIX } },
      { qrToken: { startsWith: DEMO_TOKEN_PREFIX } }
    ]
  }, 'trips');

  await countOrDelete('user', { email: { endsWith: DEMO_EMAIL_DOMAIN } }, 'demo users');

  if (!dryRun) {
    print('Demo data clear complete');
  } else {
    print('Demo data clear dry-run complete');
  }
}

main()
  .catch((error) => {
    console.error('Clear failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
