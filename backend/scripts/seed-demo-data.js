import bcrypt from 'bcryptjs';
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
const DEMO_MARKER = 'DEMO_SEED';
const DEMO_TOKEN_PREFIX = 'demo-';

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
  console.error('Refusing to run demo data script in production-like environment without both ALLOW_DEMO_DATA=true and CONFIRM_DEMO_RESET=I_UNDERSTAND_THIS_DELETES_DEMO_DATA');
  process.exit(1);
}

function normalizeDate(dateString) {
  return new Date(dateString);
}

function demoMetadata(additional = {}) {
  return { demoSeed: true, source: 'demo', ...additional };
}

async function ensureUser({ email, name, role, password }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    print(`User exists: ${email}`);
    return existing;
  }

  const passwordHash = dryRun ? `<bcrypt-hash:${password}>` : await bcrypt.hash(password, 12);
  const data = { email, name, role, passwordHash };
  print(`Creating user: ${email}`);
  if (dryRun) {
    return { id: `${DEMO_TOKEN_PREFIX}${email}`, email, name, role };
  }
  return prisma.user.create({ data });
}

async function ensureUserPreference(userId) {
  const existing = await prisma.userPreference.findUnique({ where: { userId } });
  if (existing) {
    print(`User preference exists: ${userId}`);
    return existing;
  }
  const data = {
    userId,
    defaultLocationVisibility: 'approximate',
    emailNotifications: true,
    uploadAlerts: true,
    promotionalEmails: false
  };
  print(`Creating user preference for user ${userId}`);
  if (dryRun) return { id: `${DEMO_TOKEN_PREFIX}preference-${userId}`, userId, ...data };
  return prisma.userPreference.create({ data });
}

async function ensureGuestSession({ token, displayName, scopeType, scopeId, claimedById }) {
  const existing = await prisma.guestSession.findUnique({ where: { token } });
  if (existing) {
    print(`Guest session exists: ${token}`);
    return existing;
  }

  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const data = {
    token,
    displayName,
    scopeType: scopeType ?? null,
    scopeId: scopeId ?? null,
    expiresAt,
    claimedById: claimedById ?? null
  };
  print(`Creating guest session: ${token}`);
  if (dryRun) return { id: `${DEMO_TOKEN_PREFIX}guest-${token}`, token, ...data };
  return prisma.guestSession.create({ data });
}

async function ensureLocation({ name, address, latitude, longitude, userId }) {
  const existing = await prisma.location.findFirst({ where: { name, userId } });
  if (existing) {
    print(`Location exists: ${name}`);
    return existing;
  }
  const data = { name, address, latitude, longitude, userId };
  print(`Creating location: ${name}`);
  if (dryRun) return { id: `${DEMO_TOKEN_PREFIX}location-${name}`, ...data };
  return prisma.location.create({ data });
}

async function ensurePurchaseItem({ sku, name, description, type, priceCents, previewUrl, metadata }) {
  const existing = await prisma.purchaseItem.findUnique({ where: { sku } });
  if (existing) {
    print(`Purchase item exists: ${sku}`);
    return existing;
  }
  const data = { sku, name, description, type, priceCents, previewUrl, active: true, metadata };
  print(`Creating purchase item: ${sku}`);
  if (dryRun) return { id: `${DEMO_TOKEN_PREFIX}item-${sku}`, ...data };
  return prisma.purchaseItem.create({ data });
}

async function ensureTrip({ title, destination, startDate, endDate, userId, guestSessionId, description, chapters, uploads, shareLinkToken }) {
  const qrToken = `${DEMO_TOKEN_PREFIX}${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const existing = await prisma.trip.findUnique({ where: { qrToken } });
  if (existing) {
    print(`Trip exists: ${title}`);
    return existing;
  }
  const data = {
    title,
    destination,
    startDate,
    endDate,
    userId,
    guestSessionId,
    qrToken,
  };
  print(`Creating trip: ${title}`);
  if (dryRun) return { id: `${DEMO_TOKEN_PREFIX}trip-${title}`, ...data };
  const trip = await prisma.trip.create({ data });
  if (chapters?.length) {
    await Promise.all(chapters.map((chapter) => prisma.tripChapter.upsert({
      where: { id: chapter.id ?? `${trip.id}-${chapter.title}` },
      update: { title: chapter.title, note: chapter.note },
      create: { tripId: trip.id, title: chapter.title, note: chapter.note }
    })));
  }
  return trip;
}

async function ensureTripChapter({ tripId, title, note }) {
  const existing = await prisma.tripChapter.findFirst({ where: { tripId, title } });
  if (existing) {
    print(`Trip chapter exists: ${title} for trip ${tripId}`);
    return existing;
  }
  print(`Creating trip chapter: ${title}`);
  if (dryRun) return { id: `${DEMO_TOKEN_PREFIX}chapter-${tripId}-${title}`, tripId, title, note };
  return prisma.tripChapter.create({ data: { tripId, title, note } });
}

async function ensureUpload({ tripId, eventId, guestSessionId, uploaderAnonId, fileUrl, filePublicId, fileType, status, caption, locationName, latitude, longitude, locationId, qrUploadSpaceId }) {
  const existing = await prisma.upload.findFirst({ where: { fileUrl, caption } });
  if (existing) {
    print(`Upload exists: ${caption ?? fileUrl}`);
    return existing;
  }
  const data = {
    tripId,
    eventId,
    guestSessionId,
    uploaderAnonId,
    fileUrl,
    filePublicId,
    fileType,
    status,
    caption,
    locationName,
    latitude,
    longitude,
    locationId,
    qrUploadSpaceId,
    uploaderFingerprint: `${DEMO_TOKEN_PREFIX}${uploaderAnonId}`
  };
  print(`Creating upload: ${caption ?? fileUrl}`);
  if (dryRun) return { id: `${DEMO_TOKEN_PREFIX}upload-${filePublicId}`, ...data };
  return prisma.upload.create({ data });
}

async function ensureEvent({ title, description, category, location, latitude, longitude, startDate, endDate, organizerId, guestSessionId, visibility, status, maps, zones, shareLinkToken }) {
  const qrToken = `${DEMO_TOKEN_PREFIX}${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const existing = await prisma.event.findUnique({ where: { qrToken } });
  if (existing) {
    print(`Event exists: ${title}`);
    return existing;
  }
  const data = {
    title,
    description,
    category,
    location,
    latitude,
    longitude,
    startDate,
    endDate,
    organizerId,
    guestSessionId,
    visibility,
    status,
    qrToken
  };
  print(`Creating event: ${title}`);
  if (dryRun) return { id: `${DEMO_TOKEN_PREFIX}event-${title}`, ...data };
  const event = await prisma.event.create({ data });
  if (maps?.length) {
    await Promise.all(maps.map((map) => prisma.eventMap.upsert({
      where: { id: map.id ?? `${event.id}-${map.title}` },
      update: { title: map.title, mapType: map.mapType, imageUrl: map.imageUrl, mapboxStyle: map.mapboxStyle, centerLat: map.centerLat, centerLng: map.centerLng, zoom: map.zoom, active: map.active },
      create: { eventId: event.id, ...map }
    })));
  }
  if (zones?.length) {
    await Promise.all(zones.map((zone) => prisma.mapZone.upsert({
      where: { id: zone.id ?? `${event.id}-${zone.name}` },
      update: { name: zone.name, type: zone.type, description: zone.description, x: zone.x, y: zone.y, latitude: zone.latitude, longitude: zone.longitude, shape: zone.shape, crowdStatus: zone.crowdStatus, displayOrder: zone.displayOrder },
      create: { eventId: event.id, ...zone }
    })));
  }
  if (shareLinkToken) {
    await prisma.shareLink.upsert({
      where: { token: shareLinkToken },
      update: { active: true, tripId: null, eventId: event.id },
      create: { token: shareLinkToken, tripId: null, eventId: event.id, active: true }
    });
  }
  return event;
}

async function ensureEventMap({ eventId, title, imageUrl, mapType = 'image', centerLat = null, centerLng = null, zoom = null, active = true }) {
  const existing = await prisma.eventMap.findFirst({ where: { eventId, title } });
  if (existing) {
    print(`Event map exists: ${title}`);
    return existing;
  }
  const data = { eventId, title, imageUrl, mapType, centerLat, centerLng, zoom, active };
  print(`Creating event map: ${title}`);
  if (dryRun) return { id: `${DEMO_TOKEN_PREFIX}event-map-${eventId}-${title}`, ...data };
  return prisma.eventMap.create({ data });
}

async function ensureMapZone({ eventId, name, type, description, latitude, longitude, displayOrder, qrToken, crowdStatus }) {
  const existing = await prisma.mapZone.findFirst({ where: { eventId, name } });
  if (existing) {
    print(`Map zone exists: ${name}`);
    return existing;
  }
  const data = { eventId, name, type, description, latitude, longitude, displayOrder, qrToken, crowdStatus };
  print(`Creating map zone: ${name}`);
  if (dryRun) return { id: `${DEMO_TOKEN_PREFIX}zone-${eventId}-${name}`, ...data };
  return prisma.mapZone.create({ data });
}

async function ensureQRUploadSpace({ token, title, targetType, targetId, createdByUserId, visibility, allowGuests, allowRegisteredUsers, requireApproval, latitude, longitude, locationName, metadata }) {
  const existing = await prisma.qRUploadSpace.findUnique({ where: { token } });
  if (existing) {
    print(`QR upload space exists: ${token}`);
    return existing;
  }
  const data = {
    token,
    title,
    targetType,
    targetId,
    createdByUserId,
    visibility,
    allowGuests,
    allowRegisteredUsers,
    requireApproval,
    latitude,
    longitude,
    locationName,
    metadata
  };
  print(`Creating QR upload space: ${title}`);
  if (dryRun) return { id: `${DEMO_TOKEN_PREFIX}qr-space-${token}`, ...data };
  return prisma.qRUploadSpace.create({ data });
}

async function ensureShareLink({ token, tripId, eventId }) {
  const existing = await prisma.shareLink.findUnique({ where: { token } });
  if (existing) {
    print(`Share link exists: ${token}`);
    return existing;
  }
  const data = { token, tripId, eventId, active: true };
  print(`Creating share link: ${token}`);
  if (dryRun) return { id: `${DEMO_TOKEN_PREFIX}sharelink-${token}`, ...data };
  return prisma.shareLink.create({ data });
}

async function ensureUserPurchase({ userId, itemId }) {
  const existing = await prisma.userPurchase.findUnique({ where: { userId_itemId: { userId, itemId } } });
  if (existing) {
    print(`User purchase exists: ${userId}/${itemId}`);
    return existing;
  }
  const data = { userId, itemId, status: 'owned' };
  print(`Creating user purchase: ${userId}/${itemId}`);
  if (dryRun) return { id: `${DEMO_TOKEN_PREFIX}purchase-${userId}-${itemId}`, ...data };
  return prisma.userPurchase.create({ data });
}

async function ensurePaymentTransaction({ userId, itemId, provider, status, amountCents, currency, providerRef, providerPaymentId, checkoutUrl, rawResponse }) {
  const existing = await prisma.paymentTransaction.findFirst({ where: { provider, providerRef } });
  if (existing) {
    print(`Payment transaction exists: ${providerRef}`);
    return existing;
  }
  const data = { userId, itemId, provider, status, amountCents, currency, providerRef, providerPaymentId, checkoutUrl, rawResponse };
  print(`Creating payment transaction: ${providerRef}`);
  if (dryRun) return { id: `${DEMO_TOKEN_PREFIX}tx-${providerRef}`, ...data };
  return prisma.paymentTransaction.create({ data });
}

async function ensurePaymentWebhookEvent({ provider, providerEventId, transactionId, eventType, processed, payload, errorMessage }) {
  const existing = await prisma.paymentWebhookEvent.findUnique({ where: { providerEventId } });
  if (existing) {
    print(`Payment webhook event exists: ${providerEventId}`);
    return existing;
  }
  const data = { provider, providerEventId, transactionId, eventType, processed, payload, errorMessage };
  print(`Creating payment webhook event: ${providerEventId}`);
  if (dryRun) return { id: `${DEMO_TOKEN_PREFIX}webhook-${providerEventId}`, ...data };
  return prisma.paymentWebhookEvent.create({ data });
}

async function ensureNotification({ userId, title, message, type = 'info', targetUrl = null }) {
  const existing = await prisma.notification.findFirst({ where: { userId, title } });
  if (existing) {
    print(`Notification exists: ${title}`);
    return existing;
  }
  const data = { userId, title, message, type, targetUrl };
  print(`Creating notification: ${title}`);
  if (dryRun) return { id: `${DEMO_TOKEN_PREFIX}notif-${userId}-${title}`, ...data };
  return prisma.notification.create({ data });
}

async function ensureInternalAd({ title, description, mediaUrl, mediaType, linkUrl, priority, placement }) {
  const existing = await prisma.internalAd.findFirst({ where: { title } });
  if (existing) {
    print(`Internal ad exists: ${title}`);
    return existing;
  }
  const data = { title, description, mediaUrl, mediaType, linkUrl, priority, placement, active: true };
  print(`Creating internal ad: ${title}`);
  if (dryRun) return { id: `${DEMO_TOKEN_PREFIX}ad-${title}`, ...data };
  return prisma.internalAd.create({ data });
}

async function main() {
  safetyCheck();
  print('Demo data seed started');

  const admin = await ensureUser({
    email: `admin${DEMO_EMAIL_DOMAIN}`,
    name: `${DEMO_PREFIX} Platform Admin`,
    role: 'platform_admin',
    password: 'DemoAdmin123!'
  });

  const organizer = await ensureUser({
    email: `organizer${DEMO_EMAIL_DOMAIN}`,
    name: `${DEMO_PREFIX} Organizer`,
    role: 'organizer',
    password: 'DemoOrganizer123!'
  });

  const tourist = await ensureUser({
    email: `tourist${DEMO_EMAIL_DOMAIN}`,
    name: `${DEMO_PREFIX} Tourist`,
    role: 'tourist',
    password: 'DemoTourist123!'
  });

  const guestTraveller = await ensureGuestSession({
    token: `${DEMO_TOKEN_PREFIX}guest-traveller`,
    displayName: `${DEMO_PREFIX} Guest Traveller`,
    scopeType: 'presentation',
    scopeId: 'demo-session',
    claimedById: tourist.id
  });

  await Promise.all([
    ensureUserPreference(admin.id),
    ensureUserPreference(organizer.id),
    ensureUserPreference(tourist.id)
  ]);

  const bridgetownLocation = await ensureLocation({
    name: `${DEMO_PREFIX} Bridgetown Historic District`,
    address: 'Bridgetown, Barbados',
    latitude: 13.0975,
    longitude: -59.6167,
    userId: organizer.id
  });

  const bathshebaLocation = await ensureLocation({
    name: `${DEMO_PREFIX} Bathsheba Surf Point`,
    address: 'Bathsheba, Barbados',
    latitude: 13.2214,
    longitude: -59.4882,
    userId: tourist.id
  });

  const photoFrameItem = await ensurePurchaseItem({
    sku: 'demo/photo-frame-barbados',
    name: `${DEMO_PREFIX} Barbados Photo Frame`,
    description: `${DEMO_MARKER} A demo frame item for travel photos.`,
    type: 'photo_frame',
    priceCents: 199,
    previewUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=60',
    metadata: demoMetadata({ region: 'Barbados' })
  });

  const tripBridgetown = await ensureTrip({
    title: `${DEMO_PREFIX} Bridgetown Heritage Walk`,
    destination: 'Bridgetown, Barbados',
    startDate: normalizeDate('2026-09-01T09:00:00Z'),
    endDate: normalizeDate('2026-09-03T18:00:00Z'),
    userId: tourist.id,
    guestSessionId: guestTraveller.id,
    chapters: [
      { title: 'Bridgetown Clock Tower', note: `${DEMO_MARKER} Explore the historic clock tower and nearby markets.` },
      { title: 'National Heroes Square', note: `${DEMO_MARKER} Capture the square and local heritage sites.` },
      { title: 'Harrison College Stroll', note: `${DEMO_MARKER} Walk through classic stone buildings and gardens.` }
    ]
  });

  const tripBathsheba = await ensureTrip({
    title: `${DEMO_PREFIX} Bathsheba Surf Day`,
    destination: 'Bathsheba, Barbados',
    startDate: normalizeDate('2026-09-05T08:00:00Z'),
    endDate: normalizeDate('2026-09-05T17:00:00Z'),
    userId: tourist.id,
    guestSessionId: guestTraveller.id,
    chapters: [
      { title: 'Beginner Surf Lesson', note: `${DEMO_MARKER} Learn the surf basics with an instructor.` },
      { title: 'Rock Pool Picnic', note: `${DEMO_MARKER} Enjoy a seaside lunch overlooking the ocean.` }
    ]
  });

  const tripCarlisle = await ensureTrip({
    title: `${DEMO_PREFIX} Carlisle Bay Memories`,
    destination: 'Carlisle Bay, Barbados',
    startDate: normalizeDate('2026-09-07T10:00:00Z'),
    endDate: normalizeDate('2026-09-07T15:00:00Z'),
    userId: organizer.id,
    guestSessionId: guestTraveller.id,
    chapters: [
      { title: 'Beach Time', note: `${DEMO_MARKER} Relax by turquoise water and white sand.` },
      { title: 'Boat Tour', note: `${DEMO_MARKER} Take a glass-bottom boat tour around the bay.` }
    ]
  });

  const shareBridgetown = await ensureShareLink({
    token: `${DEMO_TOKEN_PREFIX}share-bridgetown`,
    tripId: tripBridgetown.id,
    eventId: null
  });

  await Promise.all([
    ensureUpload({
      tripId: tripBridgetown.id,
      uploaderAnonId: `${DEMO_TOKEN_PREFIX}bridgetown-photo`,
      fileUrl: 'https://images.unsplash.com/photo-1526498460520-4c246339dccb?auto=format&fit=crop&w=1200&q=80',
      filePublicId: 'demo-bridgetown-1',
      fileType: 'image',
      status: 'approved',
      caption: `${DEMO_MARKER} Bridgetown market street view`,
      locationName: bridgetownLocation.name,
      latitude: bridgetownLocation.latitude,
      longitude: bridgetownLocation.longitude,
      locationId: bridgetownLocation.id
    }),
    ensureUpload({
      tripId: tripBathsheba.id,
      uploaderAnonId: `${DEMO_TOKEN_PREFIX}bathsheba-surf`,
      fileUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
      filePublicId: 'demo-bathsheba-1',
      fileType: 'image',
      status: 'approved',
      caption: `${DEMO_MARKER} Bathsheba surf day`,
      locationName: bathshebaLocation.name,
      latitude: bathshebaLocation.latitude,
      longitude: bathshebaLocation.longitude,
      locationId: bathshebaLocation.id
    })
  ]);

  const eventOistins = await ensureEvent({
    title: `${DEMO_PREFIX} Oistins Fish Fry Night`,
    description: `${DEMO_MARKER} A lively night market event with fresh fish, rum punch, and music.`,
    category: 'food',
    location: 'Oistins, Barbados',
    latitude: 13.0773,
    longitude: -59.5364,
    startDate: normalizeDate('2026-09-10T18:00:00Z'),
    endDate: normalizeDate('2026-09-10T23:00:00Z'),
    organizerId: organizer.id,
    guestSessionId: guestTraveller.id,
    visibility: 'public',
    status: 'live',
    maps: [
      { title: 'Event layout', imageUrl: 'https://images.unsplash.com/photo-1519677100203-a0e668c92439?auto=format&fit=crop&w=1200&q=80', mapType: 'image', active: true }
    ],
    zones: [
      { name: 'Live Band', type: 'music', description: `${DEMO_MARKER} Main stage for live calypso and reggae.`, latitude: 13.0775, longitude: -59.5364, displayOrder: 1, qrToken: `${DEMO_TOKEN_PREFIX}oistins-zone-1`, crowdStatus: 'moderate' },
      { name: 'Food Stalls', type: 'food', description: `${DEMO_MARKER} Fresh seafood, street eats, and local drinks.`, latitude: 13.0771, longitude: -59.5362, displayOrder: 2, qrToken: `${DEMO_TOKEN_PREFIX}oistins-zone-2`, crowdStatus: 'high' }
    ],
    shareLinkToken: `${DEMO_TOKEN_PREFIX}share-oistins`
  });

  await ensureUpload({
    eventId: eventOistins.id,
    uploaderAnonId: `${DEMO_TOKEN_PREFIX}oistins-night`,
    fileUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
    filePublicId: 'demo-oistins-1',
    fileType: 'image',
    status: 'approved',
    caption: `${DEMO_MARKER} Oistins Fish Fry night market`,
    locationName: 'Oistins Fish Fry',
    latitude: 13.0773,
    longitude: -59.5364
  });

  const qrTripSpace = await ensureQRUploadSpace({
    token: `${DEMO_TOKEN_PREFIX}trip-bridgetown-upload`,
    title: `${DEMO_PREFIX} Bridgetown Trip QR`,
    targetType: 'trip',
    targetId: tripBridgetown.id,
    createdByUserId: tourist.id,
    visibility: 'public',
    allowGuests: true,
    allowRegisteredUsers: true,
    requireApproval: false,
    latitude: bridgetownLocation.latitude,
    longitude: bridgetownLocation.longitude,
    locationName: bridgetownLocation.name,
    metadata: demoMetadata({ region: 'Barbados', target: 'trip' })
  });

  const qrEventSpace = await ensureQRUploadSpace({
    token: `${DEMO_TOKEN_PREFIX}oistins-upload`,
    title: `${DEMO_PREFIX} Oistins Event QR`,
    targetType: 'event',
    targetId: eventOistins.id,
    createdByUserId: organizer.id,
    visibility: 'public',
    allowGuests: true,
    allowRegisteredUsers: true,
    requireApproval: true,
    latitude: eventOistins.latitude,
    longitude: eventOistins.longitude,
    locationName: eventOistins.location,
    metadata: demoMetadata({ region: 'Barbados', target: 'event' })
  });

  await ensureUserPurchase({ userId: tourist.id, itemId: photoFrameItem.id });
  const paymentTransaction = await ensurePaymentTransaction({
    userId: tourist.id,
    itemId: photoFrameItem.id,
    provider: 'stripe',
    status: 'paid',
    amountCents: 199,
    currency: 'USD',
    providerRef: `${DEMO_TOKEN_PREFIX}stripe-demo-1`,
    providerPaymentId: `${DEMO_TOKEN_PREFIX}stripe-pmt-1`,
    checkoutUrl: 'https://demo.travelshare.local/checkout',
    rawResponse: demoMetadata({ demo: true })
  });
  await ensurePaymentWebhookEvent({
    provider: 'stripe',
    providerEventId: `${DEMO_TOKEN_PREFIX}webhook-1`,
    transactionId: paymentTransaction?.id,
    eventType: 'payment_intent.succeeded',
    processed: true,
    payload: demoMetadata({ status: 'succeeded' }),
    errorMessage: null
  });

  await ensureNotification({
    userId: admin.id,
    title: `${DEMO_PREFIX} Demo Data Seeded`,
    message: `${DEMO_MARKER} Benchmark demo data has been created for presentations and review.`,
    type: 'info'
  });

  await ensureNotification({
    userId: tourist.id,
    title: `${DEMO_PREFIX} Welcome to Barbados Demo`,
    message: `${DEMO_MARKER} Your demo trip and event content is available in the app.`,
    type: 'info'
  });

  await ensureInternalAd({
    title: `${DEMO_PREFIX} Barbados Island Travel Offer`,
    description: `${DEMO_MARKER} Demo ad content for Barbados attractions and sunset adventures.`,
    mediaUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    mediaType: 'image',
    linkUrl: 'https://travel-share-bb.netlify.app/events',
    priority: 10,
    placement: 'tourist'
  });

  if (!dryRun) {
    print('Demo data seed complete');
  } else {
    print('Demo data seed dry-run complete');
  }
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
