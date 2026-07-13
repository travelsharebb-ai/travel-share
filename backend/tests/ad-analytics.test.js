import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  adFindFirst: vi.fn(),
  adFindMany: vi.fn(),
  interactionCreate: vi.fn(),
  interactionGroupBy: vi.fn()
}));

vi.mock("../src/utils/prisma.js", () => ({
  prisma: {
    internalAd: {
      findFirst: mocks.adFindFirst,
      findMany: mocks.adFindMany
    },
    adInteraction: {
      create: mocks.interactionCreate,
      groupBy: mocks.interactionGroupBy
    }
  }
}));

vi.mock("../src/services/uploadOrchestrator.js", () => ({ default: { executeUploadPipeline: vi.fn() } }));
vi.mock("../src/utils/storage.js", () => ({ uploadMedia: vi.fn() }));

import adsRoutes from "../src/routes/ads.js";
import adminRoutes from "../src/routes/admin.js";
import { requireAdmin } from "../src/middleware/auth.js";

function errorHandler(error, _req, res, _next) {
  if (error.name === "ZodError") return res.status(400).json({ error: "Invalid request." });
  return res.status(error.status || 500).json({ error: error.message || "Failed." });
}

function createPublicApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use("/api/ads", adsRoutes);
  app.use(errorHandler);
  return app;
}

function createAdminApp(role = "admin") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: "admin-id", role };
    next();
  });
  app.use("/api/admin", requireAdmin, adminRoutes);
  app.use(errorHandler);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.adFindFirst.mockResolvedValue({ id: "ad-1" });
  mocks.interactionCreate.mockResolvedValue({ id: "interaction-1" });
  mocks.adFindMany.mockResolvedValue([{ id: "ad-1", title: "Test ad" }]);
  mocks.interactionGroupBy.mockResolvedValue([]);
});

describe("public ad interaction tracking", () => {
  it.each(["impression", "click"])("records a valid %s", async (type) => {
    const response = await request(createPublicApp())
      .post("/api/ads/ad-1/interaction")
      .send({ type, placement: "tourist", path: "/dashboard?ignored=true" });

    expect(response.status).toBe(202);
    expect(mocks.interactionCreate).toHaveBeenCalledWith({
      data: { adId: "ad-1", type, placement: "tourist", path: "/dashboard" },
      select: { id: true }
    });
  });

  it("rejects an invalid interaction type", async () => {
    const response = await request(createPublicApp())
      .post("/api/ads/ad-1/interaction")
      .send({ type: "hover", placement: "tourist", path: "/dashboard" });

    expect(response.status).toBe(400);
    expect(mocks.interactionCreate).not.toHaveBeenCalled();
  });

  it("does not record a nonexistent or unavailable ad", async () => {
    mocks.adFindFirst.mockResolvedValue(null);

    const response = await request(createPublicApp())
      .post("/api/ads/missing/interaction")
      .send({ type: "impression", placement: "global", path: "/" });

    expect(response.status).toBe(404);
    expect(mocks.interactionCreate).not.toHaveBeenCalled();
  });
});

describe("admin ad analytics", () => {
  it("requires an admin role", async () => {
    const response = await request(createAdminApp("tourist")).get("/api/admin/ads/analytics?days=30");

    expect(response.status).toBe(403);
    expect(mocks.interactionGroupBy).not.toHaveBeenCalled();
  });

  it("returns counts and click-through rate", async () => {
    mocks.interactionGroupBy.mockResolvedValue([
      { adId: "ad-1", type: "impression", _count: { _all: 40 } },
      { adId: "ad-1", type: "click", _count: { _all: 5 } }
    ]);

    const response = await request(createAdminApp()).get("/api/admin/ads/analytics?days=7");

    expect(response.status).toBe(200);
    expect(response.body.days).toBe(7);
    expect(response.body.ads).toEqual([{ adId: "ad-1", impressions: 40, clicks: 5, ctr: 12.5 }]);
  });
});
