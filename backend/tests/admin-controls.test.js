import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  userCount: vi.fn(),
  userFindMany: vi.fn(),
  guestFindMany: vi.fn(),
  uploadFindMany: vi.fn(),
  notificationCreate: vi.fn(),
  notificationFindMany: vi.fn()
}));

vi.mock("../src/utils/prisma.js", () => ({
  prisma: {
    user: {
      findUnique: mocks.userFindUnique,
      update: mocks.userUpdate,
      count: mocks.userCount,
      findMany: mocks.userFindMany
    },
    guestSession: { findMany: mocks.guestFindMany },
    upload: { findMany: mocks.uploadFindMany },
    notification: { create: mocks.notificationCreate, findMany: mocks.notificationFindMany }
  }
}));

vi.mock("../src/services/uploadOrchestrator.js", () => ({ default: { executeUploadPipeline: vi.fn() } }));
vi.mock("../src/utils/storage.js", () => ({ uploadMedia: vi.fn() }));

import adminRoutes from "../src/routes/admin.js";
import { cleanEvent, cleanGuestSession, cleanTrip, cleanUpload } from "../src/utils/exportImport.js";

function createTestApp(role = "platform_admin") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: "acting-admin", name: "Admin", email: "admin@example.test", role };
    next();
  });
  app.use("/api/admin", adminRoutes);
  app.use((error, _req, res, _next) => {
    if (error.name === "ZodError") return res.status(400).json({ error: "Invalid request." });
    return res.status(error.status || 500).json({ error: error.message || "Failed." });
  });
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.userFindMany.mockResolvedValue([]);
  mocks.guestFindMany.mockResolvedValue([]);
  mocks.uploadFindMany.mockResolvedValue([]);
  mocks.notificationFindMany.mockResolvedValue([]);
});

describe("admin management controls", () => {
  it("removes credential and internal storage fields from exports", () => {
    expect(cleanGuestSession({ id: "guest", token: "secret", resumeCode: "1234", passcodeHash: "hash" })).toEqual({
      id: "guest",
      displayName: undefined,
      scopeType: undefined,
      scopeId: undefined,
      expiresAt: undefined,
      claimedById: undefined,
      lastGuestAccessAt: undefined,
      createdAt: undefined,
      updatedAt: undefined
    });
    expect(cleanTrip({ id: "trip", qrToken: "secret", shareLinks: [{ token: "secret" }] })).toEqual({ id: "trip" });
    expect(cleanEvent({ id: "event", qrToken: "secret", zones: [{ id: "zone", qrToken: "secret" }] })).toEqual({ id: "event", zones: [{ id: "zone" }] });
    expect(cleanUpload({ id: "upload", uploaderAnonId: "private", filePublicId: "storage-key" })).not.toHaveProperty("filePublicId");
  });

  it("lists guests with an explicit safe field selection", async () => {
    const response = await request(createTestApp()).get("/api/admin/guests");

    expect(response.status).toBe(200);
    const query = mocks.guestFindMany.mock.calls[0][0];
    expect(query.take).toBe(100);
    expect(query.select.token).toBeUndefined();
    expect(query.select.resumeTokenHash).toBeUndefined();
    expect(query.select.resumeCode).toBeUndefined();
    expect(query.select.passcodeHash).toBeUndefined();
    expect(query.select.deviceFingerprint).toBeUndefined();
  });

  it("checks the last platform admin before attempting a demotion", async () => {
    mocks.userFindUnique.mockResolvedValue({ id: "last-admin", role: "platform_admin", name: "Last Admin" });
    mocks.userCount.mockResolvedValue(0);

    const response = await request(createTestApp())
      .patch("/api/admin/users/last-admin")
      .send({ role: "tourist" });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("last platform_admin");
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it("prevents a regular admin from changing account roles", async () => {
    mocks.userFindUnique.mockResolvedValue({ id: "target-user", role: "tourist", name: "Target" });

    const response = await request(createTestApp("admin"))
      .patch("/api/admin/users/target-user")
      .send({ role: "platform_admin" });

    expect(response.status).toBe(403);
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it("bounds moderation listings and excludes uploader credentials", async () => {
    const response = await request(createTestApp()).get("/api/admin/moderation?status=all&limit=100");

    expect(response.status).toBe(200);
    const query = mocks.uploadFindMany.mock.calls[0][0];
    expect(query.where).toEqual({});
    expect(query.take).toBe(100);
    expect(query.select.uploaderFingerprint).toBeUndefined();
    expect(query.select.filePublicId).toBeUndefined();
    expect(query.select.reportReason).toBe(true);
  });

  it("rejects external notification targets", async () => {
    const response = await request(createTestApp())
      .post("/api/admin/notifications")
      .send({ userId: "target-user", title: "Notice", message: "Message", targetUrl: "https://example.com" });

    expect(response.status).toBe(400);
    expect(mocks.notificationCreate).not.toHaveBeenCalled();
  });
});
