import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.JWT_SECRET = "reset-request-test-secret";
process.env.FRONTEND_URL = "http://localhost:5173";
process.env.NODE_ENV = "test";

const mocks = vi.hoisted(() => ({
  resetCreate: vi.fn(),
  resetFindMany: vi.fn(),
  resetFindUnique: vi.fn(),
  resetUpdate: vi.fn(),
  userFindUnique: vi.fn(),
  guestFindUnique: vi.fn(),
  guestFindMany: vi.fn(),
  guestUpdate: vi.fn(),
  guestTokenUpdateMany: vi.fn(),
  guestTokenCreate: vi.fn(),
  passwordTokenUpdateMany: vi.fn(),
  passwordTokenCreate: vi.fn(),
  auditCreate: vi.fn(),
  notifyAdmins: vi.fn(),
  sendPasswordResetEmail: vi.fn()
}));

vi.mock("../src/utils/prisma.js", () => {
  const prisma = {
    accountResetRequest: { create: mocks.resetCreate, findMany: mocks.resetFindMany, findUnique: mocks.resetFindUnique, update: mocks.resetUpdate },
    user: { findUnique: mocks.userFindUnique, findMany: vi.fn(), count: vi.fn(), update: vi.fn() },
    guestSession: { findUnique: mocks.guestFindUnique, findMany: mocks.guestFindMany, update: mocks.guestUpdate },
    guestPinResetToken: { updateMany: mocks.guestTokenUpdateMany, create: mocks.guestTokenCreate },
    passwordResetToken: { updateMany: mocks.passwordTokenUpdateMany, create: mocks.passwordTokenCreate },
    adminSecurityAuditLog: { create: mocks.auditCreate, findMany: vi.fn() },
    $transaction: vi.fn(async (input) => {
      if (typeof input === "function") {
        return input({
          accountResetRequest: { update: mocks.resetUpdate },
          adminSecurityAuditLog: { create: mocks.auditCreate }
        });
      }
      return Promise.all(input);
    })
  };
  return { prisma };
});
vi.mock("../src/services/notifications.js", () => ({ createNotification: vi.fn(), notifyActiveAdmins: mocks.notifyAdmins }));
vi.mock("../src/services/sessionService.js", () => ({
  getGuestLifecycle: vi.fn(async () => ({ state: "active", activeUntil: new Date("2030-01-02"), expiresAt: new Date("2030-01-10"), daysRemaining: 10 })),
  getOrCreateGuestSession: vi.fn(), getOrCreateCreatorSession: vi.fn(), findCreatorSession: vi.fn()
}));
vi.mock("../src/utils/email.js", () => ({ sendPasswordResetEmail: mocks.sendPasswordResetEmail, sendEmailChangeRequest: vi.fn() }));
vi.mock("../src/utils/storage.js", () => ({ uploadMedia: vi.fn() }));
vi.mock("../src/services/analyticsService.js", () => ({ getAdminAnalytics: vi.fn(), getAdminReportingDepth: vi.fn() }));
vi.mock("../src/utils/payments.js", () => ({ getPaymentReadiness: vi.fn(() => ({})) }));
vi.mock("../src/utils/skins.js", () => ({ ensureBasicSkinUnlocks: vi.fn() }));
vi.mock("../src/services/oauthTempStore.js", () => ({ oauthTempStore: {}, OAUTH_HANDOFF_TTL_MS: 1, OAUTH_STATE_TTL_MS: 1 }));

const publicRoutes = (await import("../src/routes/public.js")).default;
const authRoutes = (await import("../src/routes/auth.js")).default;
const adminRoutes = (await import("../src/routes/admin.js")).default;
const { requireAdmin } = await import("../src/middleware/auth.js");

function withErrors(instance) {
  instance.use((error, _req, res, _next) => {
    if (error.name === "ZodError") return res.status(400).json({ error: error.errors?.[0]?.message || "Invalid request." });
    return res.status(error.status || 500).json({ error: error.message || "Failed." });
  });
  return instance;
}

function publicApp() {
  const instance = express();
  instance.use(express.json());
  instance.use("/api/public", publicRoutes);
  return withErrors(instance);
}

function authApp() {
  const instance = express();
  instance.use(express.json());
  instance.use("/api/auth", authRoutes);
  return withErrors(instance);
}

function adminApp(role = "platform_admin") {
  const instance = express();
  instance.use(express.json());
  instance.use((req, _res, next) => { req.user = { id: "admin-1", email: "admin@example.test", role }; next(); });
  instance.use("/api/admin", requireAdmin, adminRoutes);
  return withErrors(instance);
}

const pendingGuestRequest = {
  id: "request-1", requesterType: "guest", requestType: "guest_pin_reset", status: "pending",
  userId: null, guestSessionId: null, guestName: "Jamie Guest", contactEmail: "jamie@example.test",
  contactNote: null, contextNote: "Island trip", message: "I lost my PIN", createdAt: new Date(),
  user: null, guestSession: null, resolvedByAdmin: null
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resetCreate.mockImplementation(async ({ data }) => ({ ...pendingGuestRequest, ...data }));
  mocks.resetFindMany.mockResolvedValue([pendingGuestRequest]);
  mocks.resetFindUnique.mockResolvedValue(pendingGuestRequest);
  mocks.resetUpdate.mockImplementation(async ({ data }) => ({ ...pendingGuestRequest, ...data }));
  mocks.guestFindUnique.mockResolvedValue({ id: "guest-1", claimedById: null, deletedAt: null });
  mocks.guestFindMany.mockResolvedValue([{ id: "guest-1", displayName: "Jamie Guest", createdAt: new Date(), expiresAt: new Date("2030-01-10"), accessRevokedAt: null, pinResetRequired: false, deletedAt: null, _count: { trips: 1, uploads: 2, events: 0, qrUploadSpaces: 0 } }]);
  mocks.guestUpdate.mockResolvedValue({ id: "guest-1" });
  mocks.guestTokenUpdateMany.mockResolvedValue({ count: 1 });
  mocks.guestTokenCreate.mockResolvedValue({ id: "token-1" });
  mocks.passwordTokenUpdateMany.mockResolvedValue({ count: 1 });
  mocks.passwordTokenCreate.mockResolvedValue({ id: "password-token-1" });
  mocks.auditCreate.mockResolvedValue({ id: "audit-1" });
  mocks.notifyAdmins.mockResolvedValue(1);
  mocks.sendPasswordResetEmail.mockResolvedValue({ sent: true });
});

describe("account reset support requests", () => {
  it("creates a guest review request without generating a recovery link from a name", async () => {
    const response = await request(publicApp()).post("/api/public/guest/pin-reset-requests").send({
      guestName: "Jamie Guest", contactEmail: "jamie@example.test", contextNote: "Island trip", message: "I lost my PIN"
    });
    expect(response.status).toBe(201);
    expect(response.body.request).toMatchObject({ status: "pending" });
    expect(response.body).not.toHaveProperty("recoveryUrl");
    expect(mocks.guestTokenCreate).not.toHaveBeenCalled();
    expect(mocks.notifyAdmins).toHaveBeenCalledWith(expect.any(String), expect.stringContaining("guest PIN"), "warning");
  });

  it("rejects a guest name-only request without contact information", async () => {
    await request(publicApp()).post("/api/public/guest/pin-reset-requests").send({ guestName: "Jamie Guest", message: "I lost my PIN" }).expect(400);
    expect(mocks.resetCreate).not.toHaveBeenCalled();
  });

  it("creates an authenticated registered-user request and notifies admins", async () => {
    mocks.userFindUnique.mockResolvedValue({ id: "user-1", name: "User", email: "user@example.test", role: "tourist", accountStatus: "active", mustResetPassword: false });
    mocks.resetCreate.mockImplementation(async ({ data }) => ({ ...pendingGuestRequest, ...data, id: "request-user", status: "pending", createdAt: new Date() }));
    const token = jwt.sign({ sub: "user-1", role: "tourist" }, process.env.JWT_SECRET);
    const response = await request(authApp()).post("/api/auth/me/password-reset-request").set("Authorization", `Bearer ${token}`).send({ message: "Please help me reset my password" });
    expect(response.status).toBe(201);
    expect(mocks.resetCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: "user-1", requestType: "password_reset" }) }));
    expect(mocks.notifyAdmins).toHaveBeenCalled();
  });

  it("allows admins to list requests and guests but blocks non-admins", async () => {
    const requestsResponse = await request(adminApp()).get("/api/admin/reset-requests?status=pending");
    expect(requestsResponse.status).toBe(200);
    expect(requestsResponse.body.requests).toHaveLength(1);
    const guestsResponse = await request(adminApp()).get("/api/admin/guests");
    expect(guestsResponse.status).toBe(200);
    expect(guestsResponse.body.guests[0]).toMatchObject({ id: "guest-1", status: "active" });
    expect(guestsResponse.body.guests[0]).not.toHaveProperty("passcodeHash");
    await request(adminApp("tourist")).get("/api/admin/reset-requests").expect(403);
  });

  it.each(["resolve", "dismiss"])("lets an admin %s a request with a reason and audit", async (action) => {
    const response = await request(adminApp()).post("/api/admin/reset-requests/request-1/action").send({ action, reason: "Verified support decision" });
    expect(response.status).toBe(200);
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: `reset_request_${action}`, reason: "Verified support decision" }) }));
  });

  it("generates a one-time guest PIN link only after admin review and never sets or returns a PIN", async () => {
    const response = await request(adminApp()).post("/api/admin/reset-requests/request-1/action").send({
      action: "generate_guest_pin_reset", reason: "Identity verified with trip details", guestSessionId: "guest-1"
    });
    expect(response.status).toBe(200);
    expect(response.body.recoveryUrl).toContain("/guest/reset-pin/");
    expect(response.body).not.toHaveProperty("pin");
    expect(mocks.guestTokenCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ tokenHash: expect.any(String), guestSessionId: "guest-1" }) });
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ resetLinkGenerated: true, oldLinksRevoked: true }) }));
  });

  it("sends a registered-user reset link from a verified request and revokes older links", async () => {
    mocks.resetFindUnique.mockResolvedValue({
      ...pendingGuestRequest,
      requesterType: "user",
      requestType: "password_reset",
      userId: "user-1",
      user: { id: "user-1", name: "User", email: "user@example.test", accountStatus: "active" }
    });
    const response = await request(adminApp()).post("/api/admin/reset-requests/request-1/action").send({
      action: "send_password_reset", reason: "Verified account owner request"
    });
    expect(response.status).toBe(200);
    expect(mocks.passwordTokenUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { revokedAt: expect.any(Date) } }));
    expect(mocks.passwordTokenCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ tokenHash: expect.any(String), userId: "user-1" }) });
    expect(mocks.sendPasswordResetEmail).toHaveBeenCalled();
    expect(response.body).not.toHaveProperty("password");
    expect(response.body).not.toHaveProperty("tokenHash");
  });

  it("requires a reason for admin request actions", async () => {
    await request(adminApp()).post("/api/admin/reset-requests/request-1/action").send({ action: "dismiss" }).expect(400);
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });
});
