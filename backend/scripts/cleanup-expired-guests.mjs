import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Read deletion window from environment or platform settings (default 14 days)
  const setting = await prisma.platformSetting.findUnique({ where: { key: 'guestDeletionDays' } }).catch(() => null);
  const deletionDays = Number(setting?.value || process.env.GUEST_DELETION_DAYS || 14);
  const cutoff = new Date(Date.now() - deletionDays * 24 * 60 * 60 * 1000);

  console.log(`Cleaning up guest sessions expired on or before ${cutoff.toISOString()}`);

  // Find guest sessions that expired before the cutoff
  const expired = await prisma.guestSession.findMany({ where: { expiresAt: { lte: cutoff } } });
  console.log(`Found ${expired.length} expired guest sessions`);

  for (const session of expired) {
    try {
      console.log(`Cleaning guest session ${session.id} (token ${session.token})`);

      // Safety-first policy:
      // - Remove guest uploads that are NOT public/approved (drafts/pending/rejected/report)
      // - For trips/events created by the guest: delete only if they contain NO approved uploads; otherwise dissociate guestSessionId (decouple lifecycle from map data)
      // This preserves public/approved map data while removing guest drafts and QR-only artifacts.

      // Delete non-approved uploads for this guest session
      const deletedUploads = await prisma.upload.deleteMany({ where: { guestSessionId: session.id, NOT: { status: 'approved' } } });
      console.log(`  deleted ${deletedUploads.count} non-approved uploads`);

      // Handle trips: if trip has any approved uploads, dissociate guestSessionId; otherwise delete the trip (and its children via cascade)
      const guestTrips = await prisma.trip.findMany({ where: { guestSessionId: session.id } });
      let tripsDeleted = 0;
      let tripsDissociated = 0;
      for (const trip of guestTrips) {
        const approvedCount = await prisma.upload.count({ where: { tripId: trip.id, status: 'approved' } });
        if (approvedCount === 0) {
          const d = await prisma.trip.deleteMany({ where: { id: trip.id } });
          tripsDeleted += d.count || 0;
        } else {
          await prisma.trip.updateMany({ where: { id: trip.id }, data: { guestSessionId: null } });
          tripsDissociated += 1;
        }
      }
      console.log(`  deleted ${tripsDeleted} trips, dissociated ${tripsDissociated} trips`);

      // Handle events similarly: delete events with no approved uploads, otherwise dissociate guestSessionId
      const guestEvents = await prisma.event.findMany({ where: { guestSessionId: session.id } });
      let eventsDeleted = 0;
      let eventsDissociated = 0;
      for (const ev of guestEvents) {
        const approvedCount = await prisma.upload.count({ where: { eventId: ev.id, status: 'approved' } });
        if (approvedCount === 0) {
          const d = await prisma.event.deleteMany({ where: { id: ev.id } });
          eventsDeleted += d.count || 0;
        } else {
          await prisma.event.updateMany({ where: { id: ev.id }, data: { guestSessionId: null } });
          eventsDissociated += 1;
        }
      }
      console.log(`  deleted ${eventsDeleted} events, dissociated ${eventsDissociated} events`);

      // Finally remove the guest session record
      await prisma.guestSession.delete({ where: { id: session.id } });
      console.log(`  removed guest session ${session.id}`);
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
