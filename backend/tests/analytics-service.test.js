import { describe, expect, it, vi } from "vitest";
import { getAdminAnalytics } from "../src/services/analyticsService.js";

function mockAnalyticsDatabase() {
  const recentDate = new Date("2026-07-10T12:00:00.000Z");
  return {
    user: {
      count: vi.fn()
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(7)
        .mockResolvedValueOnce(20),
      groupBy: vi.fn().mockResolvedValue([
        { role: "tourist", _count: { id: 80 } },
        { role: "organizer", _count: { id: 10 } },
        { role: "platform_admin", _count: { id: 10 } }
      ]),
      findMany: vi.fn().mockResolvedValue([{ id: "user-1", role: "tourist", createdAt: recentDate }])
    },
    guestSession: {
      count: vi.fn()
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(12)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(15)
        .mockResolvedValueOnce(8),
      findMany: vi.fn().mockResolvedValue([{ id: "guest-1", claimedById: null, createdAt: recentDate }])
    },
    trip: {
      count: vi.fn()
        .mockResolvedValueOnce(30)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(9),
      findMany: vi.fn().mockResolvedValue([{ id: "trip-1", createdAt: recentDate }])
    },
    event: {
      count: vi.fn()
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(6),
      findMany: vi.fn().mockResolvedValue([{ id: "event-1", status: "live", createdAt: recentDate }])
    },
    upload: {
      count: vi.fn()
        .mockResolvedValueOnce(200)
        .mockResolvedValueOnce(25)
        .mockResolvedValueOnce(70)
        .mockResolvedValueOnce(4),
      groupBy: vi.fn()
        .mockResolvedValueOnce([
          { status: "pending", _count: { id: 20 } },
          { status: "approved", _count: { id: 160 } },
          { status: "reported", _count: { id: 5 } },
          { status: "rejected", _count: { id: 15 } }
        ])
        .mockResolvedValueOnce([
          { fileType: "image", _count: { id: 150 } },
          { fileType: "video", _count: { id: 50 } }
        ])
        .mockResolvedValueOnce([{ locationName: "Bridgetown", _count: { id: 8 } }]),
      findMany: vi.fn().mockResolvedValue([{ id: "upload-1", fileType: "image", status: "approved", createdAt: recentDate }])
    },
    purchaseItem: {
      count: vi.fn().mockResolvedValueOnce(12).mockResolvedValueOnce(10)
    },
    userPurchase: { count: vi.fn().mockResolvedValue(40) },
    qRUploadSpace: {
      count: vi.fn().mockResolvedValueOnce(8).mockResolvedValueOnce(6),
      aggregate: vi.fn().mockResolvedValue({ _sum: { scanCount: 123 } })
    },
    mapZone: {
      findMany: vi.fn().mockResolvedValue([{
        id: "zone-1",
        name: "Main stage",
        crowdStatus: "moderate",
        event: { title: "Festival" },
        _count: { uploads: 9 }
      }])
    },
    $queryRaw: vi.fn().mockResolvedValue([{
      day: new Date("2026-07-10T00:00:00.000Z"),
      users: 2,
      guests: 3,
      uploads: 4
    }])
  };
}

describe("admin analytics service", () => {
  it("returns accurate bounded summaries, trends, and privacy-safe activity", async () => {
    const db = mockAnalyticsDatabase();
    const analytics = await getAdminAnalytics({
      days: 7,
      db,
      now: new Date("2026-07-11T12:00:00.000Z")
    });

    expect(analytics.range.days).toBe(7);
    expect(analytics.summary.users).toMatchObject({ total: 100, inRange: 7, newLast30Days: 20 });
    expect(analytics.summary.guests).toMatchObject({ total: 50, active: 10, claimed: 12, inRange: 5 });
    expect(analytics.summary.content).toMatchObject({
      total: 250,
      trips: 30,
      events: 20,
      uploads: 200,
      photos: 150,
      videos: 50,
      pending: 20,
      reported: 5,
      aiFlagged: 4,
      uploadsInRange: 25
    });
    expect(analytics.summary.store).toEqual({ items: 12, activeItems: 10, purchases: 40 });
    expect(analytics.summary.qr).toEqual({ spaces: 8, activeSpaces: 6, scans: 123 });
    expect(analytics.trend).toEqual([{ date: "2026-07-10", users: 2, guests: 3, uploads: 4 }]);
    expect(analytics.popularZones[0]).toMatchObject({ event: "Festival", zone: "Main stage", count: 9 });
    expect(analytics.mapHotspots[0]).toEqual({ locationName: "Bridgetown", count: 8 });
    expect(analytics.recentActivity).toHaveLength(5);
    expect(JSON.stringify(analytics.recentActivity)).not.toContain("email");
    expect(db.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 10 }));
    expect(db.upload.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 10 }));
  });
});
