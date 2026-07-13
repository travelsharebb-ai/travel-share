import { prisma } from "./prisma.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const IMPORT_ENTITIES = [
  "users",
  "settings",
  "storeItems",
  "ads",
  "guests",
  "trips",
  "events",
  "uploads",
  "purchases"
];

function isCollection(value) {
  return Array.isArray(value);
}

export function getImportPreview(payload) {
  const counts = {};
  const warnings = [];
  for (const key of IMPORT_ENTITIES) {
    counts[key] = isCollection(payload[key]) ? payload[key].length : 0;
  }
  if (!Array.isArray(payload.users) || payload.users.length === 0) {
    warnings.push("No users found in import payload; restored trips and events may not be linked to accounts.");
  }
  if (!Array.isArray(payload.trips) && !Array.isArray(payload.events)) {
    warnings.push("No trips or events found - this import package appears to contain little content.");
  }
  if (!Array.isArray(payload.uploads) || payload.uploads.length === 0) {
    warnings.push("Uploads are not included or cannot be fully restored without source storage metadata.");
  }
  return { counts, warnings };
}

function randomPasswordHash() {
  const randomValue = crypto.randomBytes(32).toString("hex");
  return bcrypt.hashSync(randomValue, 10);
}

export async function executeAdminImport(payload, adminId) {
  const preview = getImportPreview(payload);
  const userEmailMap = new Map();
  const userIdMap = new Map();
  const tripIdMap = new Map();
  const eventIdMap = new Map();
  const guestIdMap = new Map();
  const itemIdMap = new Map();
  const adIdMap = new Map();
  const created = {
    users: 0,
    settings: 0,
    storeItems: 0,
    ads: 0,
    guests: 0,
    trips: 0,
    events: 0,
    uploads: 0,
    purchases: 0
  };

  return prisma.$transaction(async (tx) => {
    const existingUsers = Array.isArray(payload.users)
      ? await tx.user.findMany({ where: { email: { in: payload.users.map((user) => user.email).filter(Boolean) } } })
      : [];
    for (const user of existingUsers) {
      userEmailMap.set(user.email, user.id);
    }

    if (Array.isArray(payload.users)) {
      for (const inputUser of payload.users) {
        if (!inputUser.email) continue;
        const existingId = userEmailMap.get(inputUser.email);
        if (existingId) {
          userIdMap.set(inputUser.id, existingId);
          continue;
        }

        const createdUser = await tx.user.create({
          data: {
            name: inputUser.name || "Imported user",
            email: inputUser.email,
            role: inputUser.role || "tourist",
            passwordHash: randomPasswordHash(),
            emailVerifiedAt: inputUser.emailVerifiedAt ? new Date(inputUser.emailVerifiedAt) : null
          }
        });
        userIdMap.set(inputUser.id, createdUser.id);
        created.users += 1;
      }
    }

    if (Array.isArray(payload.settings)) {
      for (const setting of payload.settings) {
        if (!setting?.key) continue;
        await tx.platformSetting.upsert({
          where: { key: setting.key },
          update: { value: setting.value },
          create: { key: setting.key, value: setting.value }
        });
        created.settings += 1;
      }
    }

    if (Array.isArray(payload.storeItems)) {
      for (const item of payload.storeItems) {
        const where = item.sku ? { sku: item.sku } : { id: item.id };
        try {
          const existing = item.sku ? await tx.purchaseItem.findUnique({ where: { sku: item.sku } }) : null;
          if (existing) {
            await tx.purchaseItem.update({ where: { id: existing.id }, data: { name: item.name, description: item.description || null, priceCents: item.priceCents || 0, previewUrl: item.previewUrl || null, active: item.active ?? existing.active, metadata: item.metadata || existing.metadata } });
            itemIdMap.set(item.id, existing.id);
          } else {
            const createdItem = await tx.purchaseItem.create({
              data: {
                name: item.name,
                description: item.description || null,
                type: item.type,
                priceCents: item.priceCents || 0,
                previewUrl: item.previewUrl || null,
                active: item.active ?? true,
                metadata: item.metadata || undefined,
                sku: item.sku || undefined
              }
            });
            itemIdMap.set(item.id, createdItem.id);
            created.storeItems += 1;
          }
        } catch (error) {
          // ignore invalid or duplicate store item imports
        }
      }
    }

    if (Array.isArray(payload.ads)) {
      for (const inputAd of payload.ads) {
        if (!inputAd.title || !inputAd.mediaUrl) continue;
        const existing = await tx.internalAd.findFirst({ where: { title: inputAd.title, placement: inputAd.placement } });
        if (existing) {
          await tx.internalAd.update({ where: { id: existing.id }, data: { description: inputAd.description || null, mediaUrl: inputAd.mediaUrl, mediaType: inputAd.mediaType, linkUrl: inputAd.linkUrl || null, active: inputAd.active ?? existing.active, priority: inputAd.priority ?? existing.priority, displaySeconds: inputAd.displaySeconds ?? existing.displaySeconds, startsAt: inputAd.startsAt ? new Date(inputAd.startsAt) : existing.startsAt, endsAt: inputAd.endsAt ? new Date(inputAd.endsAt) : existing.endsAt } });
          adIdMap.set(inputAd.id, existing.id);
        } else {
          const createdAd = await tx.internalAd.create({ data: {
            title: inputAd.title,
            description: inputAd.description || null,
            mediaUrl: inputAd.mediaUrl,
            mediaType: inputAd.mediaType,
            linkUrl: inputAd.linkUrl || null,
            active: inputAd.active ?? true,
            priority: inputAd.priority ?? 0,
            displaySeconds: inputAd.displaySeconds ?? null,
            startsAt: inputAd.startsAt ? new Date(inputAd.startsAt) : null,
            endsAt: inputAd.endsAt ? new Date(inputAd.endsAt) : null,
            placement: inputAd.placement || "global",
            createdById: adminId
          } });
          adIdMap.set(inputAd.id, createdAd.id);
          created.ads += 1;
        }
      }
    }

    if (Array.isArray(payload.guests)) {
      for (const guest of payload.guests) {
        if (!guest.token) continue;
        const existing = await tx.guestSession.findUnique({ where: { token: guest.token } });
        if (existing) {
          guestIdMap.set(guest.id, existing.id);
          continue;
        }
        const createdGuest = await tx.guestSession.create({ data: {
          token: guest.token,
          deviceFingerprint: guest.deviceFingerprint || null,
          scopeType: guest.scopeType || null,
          scopeId: guest.scopeId || null,
          displayName: guest.displayName || null,
          resumeTokenHash: guest.resumeTokenHash || null,
          resumeCode: guest.resumeCode || null,
          passcodeHash: guest.passcodeHash || null,
          passcodeSetAt: guest.passcodeSetAt ? new Date(guest.passcodeSetAt) : null,
          lastGuestAccessAt: guest.lastGuestAccessAt ? new Date(guest.lastGuestAccessAt) : null,
          expiresAt: guest.expiresAt ? new Date(guest.expiresAt) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          claimedById: userIdMap.get(guest.claimedById) || null
        } });
        guestIdMap.set(guest.id, createdGuest.id);
        created.guests += 1;
      }
    }

    if (Array.isArray(payload.trips)) {
      for (const trip of payload.trips) {
        const createdTrip = await tx.trip.create({ data: {
          userId: userIdMap.get(trip.userId) || null,
          title: trip.title || "Imported trip",
          destination: trip.destination || "Imported destination",
          startDate: trip.startDate ? new Date(trip.startDate) : null,
          endDate: trip.endDate ? new Date(trip.endDate) : null,
          qrToken: crypto.randomBytes(16).toString("hex"),
          qrMode: trip.qrMode || "approval_required",
          defaultLocationVisibility: trip.defaultLocationVisibility || "approximate",
          guestSessionId: guestIdMap.get(trip.guestSessionId) || null
        }, include: { chapters: true }});
        tripIdMap.set(trip.id, createdTrip.id);
        created.trips += 1;
        if (Array.isArray(trip.chapters)) {
          for (const chapter of trip.chapters) {
            await tx.tripChapter.create({ data: {
              tripId: createdTrip.id,
              title: chapter.title || "Imported chapter",
              note: chapter.note || null
            } });
          }
        }
      }
    }

    if (Array.isArray(payload.events)) {
      for (const event of payload.events) {
        const createdEvent = await tx.event.create({ data: {
          organizerId: userIdMap.get(event.organizerId) || null,
          title: event.title || "Imported event",
          description: event.description || null,
          category: event.category || null,
          location: event.location || null,
          latitude: event.latitude ?? null,
          longitude: event.longitude ?? null,
          startDate: event.startDate ? new Date(event.startDate) : new Date(),
          endDate: event.endDate ? new Date(event.endDate) : null,
          visibility: event.visibility || "public",
          status: event.status || "draft",
          coverImageUrl: event.coverImageUrl || null,
          qrToken: crypto.randomBytes(16).toString("hex"),
          guestSessionId: guestIdMap.get(event.guestSessionId) || null
        }
      });
        eventIdMap.set(event.id, createdEvent.id);
        created.events += 1;
        if (Array.isArray(event.maps)) {
          for (const map of event.maps) {
            await tx.eventMap.create({ data: {
              eventId: createdEvent.id,
              title: map.title || "Imported map",
              mapType: map.mapType || "image",
              imageUrl: map.imageUrl || null,
              mapboxStyle: map.mapboxStyle || null,
              centerLat: map.centerLat ?? null,
              centerLng: map.centerLng ?? null,
              zoom: map.zoom ?? null,
              active: map.active ?? true
            } });
          }
        }
        if (Array.isArray(event.zones)) {
          for (const zone of event.zones) {
            await tx.mapZone.create({ data: {
              eventId: createdEvent.id,
              name: zone.name || "Imported zone",
              type: zone.type || "custom",
              description: zone.description || null,
              x: zone.x ?? null,
              y: zone.y ?? null,
              latitude: zone.latitude ?? null,
              longitude: zone.longitude ?? null,
              shape: zone.shape || null,
              crowdStatus: zone.crowdStatus || "low",
              qrToken: crypto.randomBytes(16).toString("hex"),
              displayOrder: zone.displayOrder ?? 0
            } });
          }
        }
      }
    }

    if (Array.isArray(payload.uploads)) {
      for (const upload of payload.uploads) {
        const tripId = upload.tripId ? tripIdMap.get(upload.tripId) || null : null;
        const eventId = upload.eventId ? eventIdMap.get(upload.eventId) || null : null;
        const zoneId = upload.zoneId ? upload.zoneId : null;
        const guestSessionId = upload.guestSessionId ? guestIdMap.get(upload.guestSessionId) || null : null;
        await tx.upload.create({ data: {
          tripId,
          uploaderAnonId: `import-${crypto.randomBytes(6).toString("hex")}`,
          uploaderFingerprint: null,
          fileUrl: upload.fileUrl,
          filePublicId: upload.fileUrl,
          fileType: upload.fileType || "image",
          status: upload.status || "pending",
          caption: upload.caption || null,
          eventId,
          zoneId,
          guestSessionId,
          latitude: upload.latitude ?? null,
          longitude: upload.longitude ?? null,
          approximateLatitude: upload.approximateLatitude ?? null,
          approximateLongitude: upload.approximateLongitude ?? null,
          locationName: upload.locationName || null,
          region: upload.region || null,
          locationVisibility: upload.locationVisibility || "approximate",
          moderationStatus: upload.moderationStatus || null,
          downloadPurchaseItemId: upload.downloadPurchaseItemId ? itemIdMap.get(upload.downloadPurchaseItemId) || null : null,
          skinId: upload.skinId ? itemIdMap.get(upload.skinId) || null : null,
          locationId: null,
          qrUploadSpaceId: null,
          approvedAt: upload.approvedAt ? new Date(upload.approvedAt) : null,
          rejectedAt: upload.rejectedAt ? new Date(upload.rejectedAt) : null
        } });
        created.uploads += 1;
      }
    }

    if (Array.isArray(payload.purchases)) {
      for (const purchase of payload.purchases) {
        const userId = userIdMap.get(purchase.userId) || null;
        const itemId = purchase.itemId ? itemIdMap.get(purchase.itemId) || null : null;
        if (!userId || !itemId) continue;
        await tx.userPurchase.upsert({
          where: { userId_itemId: { userId, itemId } },
          update: { status: purchase.status || "owned" },
          create: { userId, itemId, status: purchase.status || "owned" }
        });
        created.purchases += 1;
      }
    }

    return { summary: created, counts: preview.counts, warnings: preview.warnings };
  });
}
