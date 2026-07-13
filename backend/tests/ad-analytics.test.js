import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  adFindFirst: vi.fn(),
  adFindMany: vi.fn(),
  adFindUnique: vi.fn(),
  adCreate: vi.fn(),
  adUpdate: vi.fn(),
  platformFindUnique: vi.fn(),
  platformUpsert: vi.fn(),
  interactionCreate: vi.fn(),
  interactionGroupBy: vi.fn(),
  uploadMedia: vi.fn()
}));

vi.mock("../src/utils/prisma.js", () => ({
  prisma: {
    internalAd: {
      findFirst: mocks.adFindFirst,
      findMany: mocks.adFindMany,
      findUnique: mocks.adFindUnique,
      create: mocks.adCreate,
      update: mocks.adUpdate
    },
    adInteraction: {
      create: mocks.interactionCreate,
      groupBy: mocks.interactionGroupBy
    },
    platformSetting: {
      findUnique: mocks.platformFindUnique,
      upsert: mocks.platformUpsert
    }
  }
}));

vi.mock("../src/utils/storage.js", () => ({ uploadMedia: mocks.uploadMedia }));

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
  mocks.adFindUnique.mockResolvedValue({ id: "ad-1" });
  mocks.adCreate.mockImplementation(async ({ data }) => ({ id: "ad-new", ...data }));
  mocks.adUpdate.mockImplementation(async ({ data }) => ({ id: "ad-1", ...data }));
  mocks.platformFindUnique.mockResolvedValue({ value: "5" });
  mocks.platformUpsert.mockResolvedValue({ key: "adRotationMinutes", value: "5" });
  mocks.interactionGroupBy.mockResolvedValue([]);
  mocks.uploadMedia.mockImplementation(async (file) => ({
    fileUrl: `https://media.example/${file.originalname}`,
    filePublicId: `ads/${file.originalname}`,
    fileType: file.mimetype.startsWith("video/") ? "video" : "image"
  }));
});

describe("admin ad media upload", () => {
  it.each([
    ["image", "banner.png", "image/png"],
    ["video", "launch.mp4", "video/mp4"]
  ])("accepts an admin %s upload and returns stable media fields", async (mediaType, filename, contentType) => {
    const response = await request(createAdminApp())
      .post("/api/admin/ads/media")
      .attach("file", Buffer.from("test-media"), { filename, contentType });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      url: `https://media.example/${filename}`,
      mediaUrl: `https://media.example/${filename}`,
      mediaType,
      filename,
      mimeType: contentType,
      media: { fileUrl: `https://media.example/${filename}`, fileType: mediaType }
    });
    expect(mocks.uploadMedia).toHaveBeenCalledOnce();
  });

  it("rejects an unsafe file type before storage", async () => {
    const response = await request(createAdminApp())
      .post("/api/admin/ads/media")
      .attach("file", Buffer.from("not-media"), { filename: "payload.html", contentType: "text/html" });

    expect(response.status).toBe(400);
    expect(mocks.uploadMedia).not.toHaveBeenCalled();
  });

  it.each([
    ["image", "banner.png"],
    ["video", "launch.mp4"]
  ])("persists uploaded %s fields when creating an ad", async (mediaType, filename) => {
    const mediaUrl = `https://media.example/${filename}`;
    const response = await request(createAdminApp())
      .post("/api/admin/ads")
      .send({
        title: `Launch ${mediaType}`,
        mediaUrl,
        mediaType,
        placement: "global"
      });

    expect(response.status).toBe(201);
    expect(mocks.adCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        mediaUrl,
        mediaType,
        createdById: "admin-id"
      })
    });
  });

  it("persists replacement video fields when updating an ad", async () => {
    const response = await request(createAdminApp())
      .patch("/api/admin/ads/ad-1")
      .send({ mediaUrl: "https://media.example/replacement.webm", mediaType: "video" });

    expect(response.status).toBe(200);
    expect(mocks.adUpdate).toHaveBeenCalledWith({
      where: { id: "ad-1" },
      data: expect.objectContaining({
        mediaUrl: "https://media.example/replacement.webm",
        mediaType: "video"
      })
    });
  });

  it.each([
    ["video", "launch.mp4"],
    ["image", "banner.png"]
  ])("returns uploaded %s fields from the public ads endpoint", async (mediaType, filename) => {
    const mediaUrl = `https://media.example/${filename}`;
    mocks.adFindMany.mockResolvedValue([{
      id: "ad-1",
      title: `Launch ${mediaType}`,
      mediaUrl,
      mediaType
    }]);

    const response = await request(createPublicApp()).get("/api/ads?placement=global");

    expect(response.status).toBe(200);
    expect(response.body.rotationMinutes).toBe(5);
    expect(response.body.ads[0]).toMatchObject({
      mediaUrl,
      mediaType
    });
  });

  it("lets an admin update the global rotation interval", async () => {
    const response = await request(createAdminApp())
      .patch("/api/admin/ads/config")
      .send({ rotationMinutes: 8 });

    expect(response.status).toBe(200);
    expect(response.body.rotationMinutes).toBe(8);
    expect(mocks.platformUpsert).toHaveBeenCalledWith({
      where: { key: "adRotationMinutes" },
      update: { value: "8" },
      create: { key: "adRotationMinutes", value: "8" }
    });
  });
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
