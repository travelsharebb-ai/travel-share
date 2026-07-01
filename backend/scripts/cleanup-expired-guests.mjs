import { PrismaClient } from '@prisma/client';
import { deleteMedia } from '../src/utils/storage.js';

const prisma = new PrismaClient();

async function main() {
  const dryRun = process.argv.includes('--dry-run') || process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
  const now = new Date();
  console.log(`Cleaning up expired guest sessions at ${now.toISOString()} (${dryRun ? 'DRY RUN' : 'LIVE'})`);

  // Find guest sessions that are expired and unclaimed
  const expired = await prisma.guestSession.findMany({ where: { expiresAt: { lte: now }, claimedById: null } });
  console.log(`Found ${expired.length} expired guest sessions`);

  for (const session of expired) {
    try {
      console.log(`Cleaning guest session ${session.id} (token ${session.token})`);

      // Delete unapproved guest uploads and their storage. Preserve approved uploads.
      const uploads = await prisma.upload.findMany({ where: { guestSessionId: session.id }, select: { id: true, filePublicId: true, status: true } });
      const unapprovedUploadIds = uploads.filter((u) => u.status !== 'approved').map((u) => u.id);
      const unapprovedFileIds = uploads.filter((u) => u.status !== 'approved' && u.filePublicId).map((u) => u.filePublicId);
      console.log(`  guest owns ${uploads.length} uploads, deleting ${unapprovedUploadIds.length} unapproved uploads`);

      if (!dryRun && unapprovedFileIds.length) {
        for (const filePublicId of unapprovedFileIds) {
          try {
            await deleteMedia(filePublicId);
          } catch (err) {
            console.warn(`    failed to delete storage for ${filePublicId}: ${err?.message || err}`);
          }
        }
      }
      if (!dryRun && unapprovedUploadIds.length) {
        await prisma.uploadState.deleteMany({ where: { uploadId: { in: unapprovedUploadIds } } });
        await prisma.upload.deleteMany({ where: { id: { in: unapprovedUploadIds } } });
      }

      // Preserve approved uploads and detach them from the expiring guest session.
      const approvedUploadIds = uploads.filter((u) => u.status === 'approved').map((u) => u.id);
      if (!dryRun && approvedUploadIds.length) {
        await prisma.upload.updateMany({ where: { id: { in: approvedUploadIds } }, data: { guestSessionId: null } });
      }
      console.log(`  preserved ${approvedUploadIds.length} approved uploads`);

      // Handle guest-owned trips.
      const guestTrips = await prisma.trip.findMany({ where: { guestSessionId: session.id }, select: { id: true } });
      let tripsDeleted = 0;
      let tripsDetached = 0;
      for (const trip of guestTrips) {
        const approvedCount = await prisma.upload.count({ where: { tripId: trip.id, status: 'approved' } });
        if (approvedCount === 0) {
          const tripUploads = await prisma.upload.findMany({ where: { tripId: trip.id }, select: { id: true, filePublicId: true } });
          const tripUploadIds = tripUploads.map((u) => u.id);
          const tripFileIds = tripUploads.filter((u) => u.filePublicId).map((u) => u.filePublicId);
          if (!dryRun && tripFileIds.length) {
            for (const filePublicId of tripFileIds) {
              try {
                await deleteMedia(filePublicId);
              } catch (err) {
                console.warn(`    failed to delete storage for trip upload ${filePublicId}: ${err?.message || err}`);
              }
            }
          }
          if (!dryRun && tripUploadIds.length) {
            await prisma.uploadState.deleteMany({ where: { uploadId: { in: tripUploadIds } } });
          }
          if (!dryRun) {
            await prisma.trip.delete({ where: { id: trip.id } });
          }
          tripsDeleted += 1;
        } else {
          if (!dryRun) {
            await prisma.trip.update({ where: { id: trip.id }, data: { guestSessionId: null } });
            await prisma.upload.updateMany({ where: { tripId: trip.id, guestSessionId: session.id }, data: { guestSessionId: null } });
          }
          tripsDetached += 1;
        }
      }
      console.log(`  deleted ${tripsDeleted} trips, detached ${tripsDetached} trips`);

      // Handle guest-owned events.
      const guestEvents = await prisma.event.findMany({ where: { guestSessionId: session.id }, select: { id: true } });
      let eventsDeleted = 0;
      let eventsDetached = 0;
      for (const ev of guestEvents) {
        const approvedCount = await prisma.upload.count({ where: { eventId: ev.id, status: 'approved' } });
        if (approvedCount === 0) {
          const eventUploads = await prisma.upload.findMany({ where: { eventId: ev.id }, select: { id: true, filePublicId: true } });
          const eventUploadIds = eventUploads.map((u) => u.id);
          const eventFileIds = eventUploads.filter((u) => u.filePublicId).map((u) => u.filePublicId);
          if (!dryRun && eventFileIds.length) {
            for (const filePublicId of eventFileIds) {
              try {
                await deleteMedia(filePublicId);
              } catch (err) {
                console.warn(`    failed to delete storage for event upload ${filePublicId}: ${err?.message || err}`);
              }
            }
          }
          if (!dryRun && eventUploadIds.length) {
            await prisma.uploadState.deleteMany({ where: { uploadId: { in: eventUploadIds } } });
          }
          if (!dryRun) {
            await prisma.event.delete({ where: { id: ev.id } });
          }
          eventsDeleted += 1;
        } else {
          if (!dryRun) {
            await prisma.event.update({ where: { id: ev.id }, data: { guestSessionId: null } });
            await prisma.upload.updateMany({ where: { eventId: ev.id, guestSessionId: session.id }, data: { guestSessionId: null } });
          }
          eventsDetached += 1;
        }
      }
      console.log(`  deleted ${eventsDeleted} events, detached ${eventsDetached} events`);

      if (!dryRun) {
        await prisma.guestSession.delete({ where: { id: session.id } });
      }
      console.log(`  ${dryRun ? 'would remove' : 'removed'} guest session ${session.id}`);
    } catch (err) {
      console.error(`Failed to clean guest ${session.id}`, err);
    }
  }

  console.log('Guest cleanup complete');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
