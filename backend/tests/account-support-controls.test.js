import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.FRONTEND_URL = "http://localhost:5173";
process.env.NODE_ENV = "test";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(), userUpdate: vi.fn(), userCount: vi.fn(),
  resetUpdateMany: vi.fn(), resetCreate: vi.fn(),
  guestFindUnique: vi.fn(), guestUpdate: vi.fn(),
  guestResetUpdateMany: vi.fn(), guestResetCreate: vi.fn(),
  auditCreate: vi.fn(), sendPasswordResetEmail: vi.fn()
}));

vi.mock("../src/utils/prisma.js", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique, update: mocks.userUpdate, count: mocks.userCount },
    passwordResetToken: { updateMany: mocks.resetUpdateMany, create: mocks.resetCreate },
    guestSession: { findUnique: mocks.guestFindUnique, update: mocks.guestUpdate },
    guestPinResetToken: { updateMany: mocks.guestResetUpdateMany, create: mocks.guestResetCreate },
    adminSecurityAuditLog: { create: mocks.auditCreate },
    $transaction: vi.fn(async (operations) => Promise.all(operations))
  }
}));
vi.mock("../src/utils/email.js", () => ({ sendPasswordResetEmail: mocks.sendPasswordResetEmail }));
vi.mock("../src/utils/storage.js", () => ({ uploadMedia: vi.fn() }));
vi.mock("../src/services/notifications.js", () => ({ createNotification: vi.fn(), notifyActiveAdmins: vi.fn() }));
vi.mock("../src/services/analyticsService.js", () => ({ getAdminAnalytics: vi.fn(), getAdminReportingDepth: vi.fn() }));
vi.mock("../src/utils/payments.js", () => ({ getPaymentReadiness: vi.fn(() => ({})) }));

const adminRoutes = (await import("../src/routes/admin.js")).default;
const { requireAdmin } = await import("../src/middleware/auth.js");

function app(role = "platform_admin") {
  const instance = express();
  instance.use(express.json());
  instance.use((req, _res, next) => {
    req.user = { id: "admin-1", email: "admin@example.test", role };
    next();
  });
  instance.use("/api/admin", requireAdmin, adminRoutes);
  instance.use((error, _req, res, _next) => {
    if (error.name === "ZodError") return res.status(400).json({ error: error.errors?.[0]?.message || "Invalid request." });
    return res.status(error.status || 500).json({ error: error.message || "Failed." });
  });
  return instance;
}

const user = { id: "user-1", name: "Target", email: "target@example.test", role: "tourist", accountStatus: "active", mustResetPassword: false };
const guest = { id: "guest-1", displayName: "Guest", accessRevokedAt: null, pinResetRequired: false, deletedAt: null };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.userFindUnique.mockResolvedValue(user);
  mocks.userUpdate.mockResolvedValue(user);
  mocks.userCount.mockResolvedValue(1);
  mocks.resetUpdateMany.mockResolvedValue({ count: 1 });
  mocks.resetCreate.mockResolvedValue({ id: "reset-1" });
  mocks.guestFindUnique.mockResolvedValue(guest);
  mocks.guestUpdate.mockResolvedValue(guest);
  mocks.guestResetUpdateMany.mockResolvedValue({ count: 1 });
  mocks.guestResetCreate.mockResolvedValue({ id: "guest-reset-1" });
  mocks.auditCreate.mockResolvedValue({ id: "audit-1" });
  mocks.sendPasswordResetEmail.mockResolvedValue({ sent: true });
});

describe("admin support and account controls", () => {
  it("requires an admin and a reason for every support action", async () => {
    await request(app("tourist")).post("/api/admin/users/user-1/support").send({ action: "suspend", reason: "Support case" }).expect(403);
    await request(app()).post("/api/admin/users/user-1/support").send({ action: "suspend" }).expect(400);
    await request(app()).post("/api/admin/guests/guest-1/support").send({ action: "revoke_access", reason: "no" }).expect(400);
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("generates a one-time password reset, revokes old links, sends email, and audits without returning a hash", async () => {
    const response = await request(app()).post("/api/admin/users/user-1/support").send({ action: "send_password_reset", reason: "User requested support" });
    expect(response.status).toBe(200);
    expect(mocks.resetUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { revokedAt: expect.any(Date) } }));
    expect(mocks.resetCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: "user-1", tokenHash: expect.any(String) }) });
    expect(mocks.sendPasswordResetEmail).toHaveBeenCalled();
    expect(response.body).not.toHaveProperty("tokenHash");
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "send_password_reset", oldLinksRevoked: true, resetLinkGenerated: true }) }));
  });

  it("reports email delivery failure clearly and still audits the generated reset link", async () => {
    mocks.sendPasswordResetEmail.mockResolvedValue({ sent: false, error: "Email delivery is not configured" });
    const response = await request(app()).post("/api/admin/users/user-1/support").send({ action: "send_password_reset", reason: "User requested support" });
    expect(response.status).toBe(502);
    expect(response.body.error).toContain("email delivery failed");
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "send_password_reset", metadata: expect.objectContaining({ emailSent: false }) }) }));
  });

  it.each([
    ["expire_password_resets", null],
    ["force_password_reset", { mustResetPassword: true }],
    ["suspend", { accountStatus: "suspended" }],
    ["reactivate", { accountStatus: "active" }],
    ["close", { accountStatus: "closed" }]
  ])("performs and audits registered-user action %s", async (action, expectedUpdate) => {
    const response = await request(app()).post("/api/admin/users/user-1/support").send({ action, reason: "Documented support reason" });
    expect(response.status).toBe(200);
    if (expectedUpdate) expect(mocks.userUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining(expectedUpdate) }));
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action, reason: "Documented support reason" }) }));
  });

  it("anonymizes without deleting payment, purchase, content, or audit records", async () => {
    const response = await request(app()).post("/api/admin/users/user-1/support").send({ action: "anonymize", reason: "Approved privacy request", confirmation: true });
    expect(response.status).toBe(200);
    expect(mocks.userUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ accountStatus: "anonymized", email: "deleted+user-1@example.invalid" }) }));
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "anonymize" }) }));
  });

  it("generates a hashed guest recovery token, revokes old links, and never sets or returns a PIN", async () => {
    const response = await request(app()).post("/api/admin/guests/guest-1/support").send({ action: "generate_pin_reset", reason: "Guest verified by support" });
    expect(response.status).toBe(200);
    expect(response.body.recoveryUrl).toContain("/guest/reset-pin/");
    expect(response.body).not.toHaveProperty("pin");
    expect(response.body).not.toHaveProperty("passcodeHash");
    expect(mocks.guestResetCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ guestSessionId: "guest-1", tokenHash: expect.any(String) }) });
    expect(mocks.guestUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { resumeCode: null, resumeTokenHash: null, pinResetRequired: true } }));
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "generate_pin_reset", resetLinkGenerated: true, oldLinksRevoked: true }) }));
  });

  it.each([
    ["revoke_links", false],
    ["force_pin_reset", false],
    ["revoke_access", false],
    ["delete_session", true]
  ])("performs and audits guest action %s", async (action, confirmation) => {
    const response = await request(app()).post("/api/admin/guests/guest-1/support").send({ action, reason: "Documented guest support reason", confirmation });
    expect(response.status).toBe(200);
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action, reason: "Documented guest support reason" }) }));
    const serializedCalls = JSON.stringify(mocks.guestUpdate.mock.calls);
    expect(serializedCalls).not.toContain("newPin");
  });
});
