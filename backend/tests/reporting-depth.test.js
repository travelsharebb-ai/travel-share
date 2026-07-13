import { describe, expect, it, vi } from "vitest";
import { getAdminReportingDepth } from "../src/services/analyticsService.js";

describe("admin reporting depth", () => {
  it("returns real ad, event and payment aggregates without personal data", async () => {
    const db = {
      adInteraction: { count: vi.fn().mockResolvedValueOnce(100).mockResolvedValueOnce(5) },
      event: { findMany: vi.fn().mockResolvedValue([{ id: "event-1", title: "Festival", _count: { uploads: 12 } }]) },
      paymentTransaction: { groupBy: vi.fn().mockResolvedValue([{ status: "paid", _count: { id: 3 } }]) }
    };
    const reporting = await getAdminReportingDepth({ days: 7, db, now: new Date("2026-07-13T12:00:00Z") });
    expect(reporting.ads).toEqual({ impressions: 100, clicks: 5, ctr: 5 });
    expect(reporting.topEvents).toEqual([{ id: "event-1", title: "Festival", uploads: 12 }]);
    expect(reporting.payments.statuses).toEqual({ paid: 3 });
    expect(JSON.stringify(reporting)).not.toContain("email");
  });
});
