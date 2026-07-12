import { prisma } from "../utils/prisma.js";

function rangeStart(now, days) {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return start;
}

function countMap(rows, key) {
  return Object.fromEntries(rows.map((row) => [row[key], row._count.id]));
}

function recentActivity(items) {
  return items
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, 20)
    .map((item) => ({ ...item, createdAt: item.createdAt.toISOString() }));
}

export async function getAdminAnalytics({ days = 30, db = prisma, now = new Date() } = {}) {
  const from = rangeStart(now, days);
  const sevenDaysAgo = rangeStart(now, 7);
  const thirtyDaysAgo = rangeStart(now, 30);

  const [
    usersTotal,
    usersLast7Days,
    usersLast30Days,
    usersByRole,
    guestsTotal,
    guestsActive,
    guestsClaimed,
    guestsLast7Days,
    guestsLast30Days,
    guestsRecentlyActive,
    tripsTotal,
    tripsLast7Days,
    tripsLast30Days,
    eventsTotal,
    eventsLast7Days,
    eventsLast30Days,
    uploadsTotal,
    uploadsLast7Days,
    uploadsLast30Days,
    uploadsByStatus,
    uploadsByFileType,
    aiFlaggedUploads,
    storeItemsTotal,
    activeStoreItems,
    purchasesTotal,
    qrSpacesTotal,
    activeQrSpaces,
    qrScanAggregate,
    zones,
    mapHotspots,
    recentUsers,
    recentGuests,
    recentTrips,
    recentEvents,
    recentUploads,
    trendRows
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    db.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    db.user.groupBy({ by: ["role"], _count: { id: true } }),
    db.guestSession.count(),
    db.guestSession.count({ where: { claimedById: null, expiresAt: { gt: now } } }),
    db.guestSession.count({ where: { claimedById: { not: null } } }),
    db.guestSession.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    db.guestSession.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    db.guestSession.count({ where: { lastGuestAccessAt: { gte: sevenDaysAgo } } }),
    db.trip.count(),
    db.trip.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    db.trip.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    db.event.count(),
    db.event.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    db.event.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    db.upload.count(),
    db.upload.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    db.upload.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    db.upload.groupBy({ by: ["status"], _count: { id: true } }),
    db.upload.groupBy({ by: ["fileType"], _count: { id: true } }),
    db.upload.count({ where: { aiFlagged: true } }),
    db.purchaseItem.count(),
    db.purchaseItem.count({ where: { active: true } }),
    db.userPurchase.count(),
    db.qRUploadSpace.count(),
    db.qRUploadSpace.count({
      where: {
        deletedAt: null,
        disabledAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
      }
    }),
    db.qRUploadSpace.aggregate({ _sum: { scanCount: true } }),
    db.mapZone.findMany({
      include: { event: { select: { title: true } }, _count: { select: { uploads: true } } },
      orderBy: { uploads: { _count: "desc" } },
      take: 10
    }),
    db.upload.groupBy({
      by: ["locationName"],
      where: { locationName: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10
    }),
    db.user.findMany({ orderBy: { createdAt: "desc" }, take: 10, select: { id: true, role: true, createdAt: true } }),
    db.guestSession.findMany({ orderBy: { createdAt: "desc" }, take: 10, select: { id: true, claimedById: true, createdAt: true } }),
    db.trip.findMany({ orderBy: { createdAt: "desc" }, take: 10, select: { id: true, createdAt: true } }),
    db.event.findMany({ orderBy: { createdAt: "desc" }, take: 10, select: { id: true, status: true, createdAt: true } }),
    db.upload.findMany({ orderBy: { createdAt: "desc" }, take: 10, select: { id: true, fileType: true, status: true, createdAt: true } }),
    db.$queryRaw`
      WITH days AS (
        SELECT date_trunc('day', ${now}::timestamptz AT TIME ZONE 'UTC')
          - (day_offset * interval '1 day') AS day
        FROM generate_series(${days - 1}, 0, -1) AS offsets(day_offset)
      ), user_counts AS (
        SELECT date_trunc('day', "createdAt" AT TIME ZONE 'UTC') AS day, COUNT(*)::int AS count
        FROM "User"
        WHERE "createdAt" >= ${from} AND "createdAt" <= ${now}
        GROUP BY 1
      ), guest_counts AS (
        SELECT date_trunc('day', "createdAt" AT TIME ZONE 'UTC') AS day, COUNT(*)::int AS count
        FROM "GuestSession"
        WHERE "createdAt" >= ${from} AND "createdAt" <= ${now}
        GROUP BY 1
      ), upload_counts AS (
        SELECT date_trunc('day', "createdAt" AT TIME ZONE 'UTC') AS day, COUNT(*)::int AS count
        FROM "Upload"
        WHERE "createdAt" >= ${from} AND "createdAt" <= ${now}
        GROUP BY 1
      )
      SELECT days.day,
        COALESCE(user_counts.count, 0)::int AS users,
        COALESCE(guest_counts.count, 0)::int AS guests,
        COALESCE(upload_counts.count, 0)::int AS uploads
      FROM days
      LEFT JOIN user_counts ON user_counts.day = days.day
      LEFT JOIN guest_counts ON guest_counts.day = days.day
      LEFT JOIN upload_counts ON upload_counts.day = days.day
      ORDER BY days.day ASC
    `
  ]);

  const roleCounts = countMap(usersByRole, "role");
  const statusCounts = countMap(uploadsByStatus, "status");
  const fileTypeCounts = countMap(uploadsByFileType, "fileType");
  const inRange = days === 7 ? {
    users: usersLast7Days,
    guests: guestsLast7Days,
    trips: tripsLast7Days,
    events: eventsLast7Days,
    uploads: uploadsLast7Days
  } : {
    users: usersLast30Days,
    guests: guestsLast30Days,
    trips: tripsLast30Days,
    events: eventsLast30Days,
    uploads: uploadsLast30Days
  };

  return {
    generatedAt: now.toISOString(),
    range: { days, from: from.toISOString(), to: now.toISOString() },
    summary: {
      users: { total: usersTotal, newLast7Days: usersLast7Days, newLast30Days: usersLast30Days, inRange: inRange.users, byRole: roleCounts },
      guests: {
        total: guestsTotal,
        active: guestsActive,
        claimed: guestsClaimed,
        recentlyActive: guestsRecentlyActive,
        newLast7Days: guestsLast7Days,
        newLast30Days: guestsLast30Days,
        inRange: inRange.guests
      },
      content: {
        total: tripsTotal + eventsTotal + uploadsTotal,
        trips: tripsTotal,
        events: eventsTotal,
        uploads: uploadsTotal,
        photos: fileTypeCounts.image || 0,
        videos: fileTypeCounts.video || 0,
        pending: statusCounts.pending || 0,
        approved: statusCounts.approved || 0,
        rejected: statusCounts.rejected || 0,
        reported: statusCounts.reported || 0,
        aiFlagged: aiFlaggedUploads,
        newUploadsLast7Days: uploadsLast7Days,
        newUploadsLast30Days: uploadsLast30Days,
        uploadsInRange: inRange.uploads,
        tripsInRange: inRange.trips,
        eventsInRange: inRange.events
      },
      store: { items: storeItemsTotal, activeItems: activeStoreItems, purchases: purchasesTotal },
      qr: { spaces: qrSpacesTotal, activeSpaces: activeQrSpaces, scans: qrScanAggregate._sum.scanCount || 0 }
    },
    trend: trendRows.map((row) => ({
      date: row.day.toISOString().slice(0, 10),
      users: Number(row.users),
      guests: Number(row.guests),
      uploads: Number(row.uploads)
    })),
    recentActivity: recentActivity([
      ...recentUsers.map((item) => ({ id: `user:${item.id}`, type: "user", role: item.role, createdAt: item.createdAt })),
      ...recentGuests.map((item) => ({ id: `guest:${item.id}`, type: "guest", claimed: Boolean(item.claimedById), createdAt: item.createdAt })),
      ...recentTrips.map((item) => ({ id: `trip:${item.id}`, type: "trip", createdAt: item.createdAt })),
      ...recentEvents.map((item) => ({ id: `event:${item.id}`, type: "event", status: item.status, createdAt: item.createdAt })),
      ...recentUploads.map((item) => ({ id: `upload:${item.id}`, type: "upload", status: item.status, fileType: item.fileType, createdAt: item.createdAt }))
    ]),
    popularZones: zones.map((zone) => ({
      id: zone.id,
      event: zone.event.title,
      zone: zone.name,
      count: zone._count.uploads,
      crowdStatus: zone.crowdStatus
    })),
    mapHotspots: mapHotspots.map((item) => ({ locationName: item.locationName, count: item._count.id }))
  };
}
