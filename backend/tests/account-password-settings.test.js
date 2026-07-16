import express from "express";
import request from "supertest";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.JWT_SECRET = "account-security-test-secret";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  resetUpdateMany: vi.fn(),
  auditCreate: vi.fn()
}));

vi.mock("../src/utils/prisma.js", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique, update: mocks.userUpdate },
    passwordResetToken: { updateMany: mocks.resetUpdateMany },
    adminSecurityAuditLog: { create: mocks.auditCreate },
    $transaction: vi.fn(async (input) => {
      if (typeof input === "function") return input({
        user: { update: mocks.userUpdate },
        passwordResetToken: { updateMany: mocks.resetUpdateMany },
        adminSecurityAuditLog: { create: mocks.auditCreate }
      });
      return Promise.all(input);
    })
  }
}));
vi.mock("../src/utils/skins.js", () => ({ ensureBasicSkinUnlocks: vi.fn() }));
vi.mock("../src/services/notifications.js", () => ({ createNotification: vi.fn() }));
vi.mock("../src/utils/email.js", () => ({ sendPasswordResetEmail: vi.fn(), sendEmailChangeRequest: vi.fn() }));
vi.mock("../src/services/oauthTempStore.js", () => ({ oauthTempStore: {}, OAUTH_HANDOFF_TTL_MS: 1, OAUTH_STATE_TTL_MS: 1 }));

const authRoutes = (await import("../src/routes/auth.js")).default;
const { requireAuth } = await import("../src/middleware/auth.js");

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use("/api/auth", authRoutes);
  instance.use((error, _req, res, _next) => {
    if (error.name === "ZodError") return res.status(400).json({ error: error.errors?.[0]?.message || "Invalid request." });
    return res.status(error.status || 500).json({ error: error.message || "Failed." });
  });
  return instance;
}

function tokenFor(id = "user-1") {
  return jwt.sign({ sub: id, role: "tourist" }, process.env.JWT_SECRET);
}

async function authenticatedUser(role = "tourist", password = "OldPassword1") {
  const passwordHash = await bcrypt.hash(password, 4);
  mocks.userFindUnique
    .mockResolvedValueOnce({ id: "user-1", name: "User", email: "user@example.test", role, accountStatus: "active", mustResetPassword: false })
    .mockResolvedValueOnce({ passwordHash });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.userUpdate.mockResolvedValue({ id: "user-1" });
  mocks.resetUpdateMany.mockResolvedValue({ count: 1 });
  mocks.auditCreate.mockResolvedValue({ id: "audit-1" });
});

describe("registered account password settings", () => {
  it.each(["tourist", "platform_admin"])("allows a %s to change their own password", async (role) => {
    await authenticatedUser(role);
    const response = await request(app())
      .patch("/api/auth/me/password")
      .set("Authorization", `Bearer ${tokenFor()}`)
      .send({ currentPassword: "OldPassword1", newPassword: "NewPassword2", confirmPassword: "NewPassword2" });

    expect(response.status).toBe(200);
    const update = mocks.userUpdate.mock.calls[0][0].data;
    expect(update.passwordHash).not.toBe("NewPassword2");
    expect(await bcrypt.compare("NewPassword2", update.passwordHash)).toBe(true);
    expect(response.body).not.toHaveProperty("passwordHash");
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "password_changed" }) }));
  });

  it("rejects the wrong current password", async () => {
    await authenticatedUser("tourist");
    const response = await request(app()).patch("/api/auth/me/password").set("Authorization", `Bearer ${tokenFor()}`).send({ currentPassword: "WrongPassword1", newPassword: "NewPassword2", confirmPassword: "NewPassword2" });
    expect(response.status).toBe(403);
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it.each([
    ["weak password", { currentPassword: "OldPassword1", newPassword: "weak", confirmPassword: "weak" }],
    ["mismatched confirmation", { currentPassword: "OldPassword1", newPassword: "NewPassword2", confirmPassword: "DifferentPassword3" }]
  ])("rejects %s", async (_label, body) => {
    mocks.userFindUnique.mockResolvedValueOnce({ id: "user-1", name: "User", email: "user@example.test", role: "tourist", accountStatus: "active", mustResetPassword: false });
    const response = await request(app()).patch("/api/auth/me/password").set("Authorization", `Bearer ${tokenFor()}`).send(body);
    expect(response.status).toBe(400);
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated password changes", async () => {
    await request(app()).patch("/api/auth/me/password").send({ currentPassword: "OldPassword1", newPassword: "NewPassword2", confirmPassword: "NewPassword2" }).expect(401);
  });

  it("blocks normal authenticated access until a forced password reset is completed", async () => {
    mocks.userFindUnique.mockResolvedValue({ id: "user-1", name: "User", email: "user@example.test", role: "tourist", accountStatus: "active", mustResetPassword: true });
    const protectedApp = express();
    protectedApp.get("/api/trips", requireAuth, (_req, res) => res.json({ ok: true }));
    const response = await request(protectedApp).get("/api/trips").set("Authorization", `Bearer ${tokenFor()}`);
    expect(response.status).toBe(403);
    expect(response.body.code).toBe("PASSWORD_RESET_REQUIRED");
  });

  it.each(["suspended", "closed", "anonymized"])("blocks login for a %s account", async (accountStatus) => {
    mocks.userFindUnique.mockResolvedValue({ id: "user-1", email: "user@example.test", passwordHash: await bcrypt.hash("OldPassword1", 4), role: "tourist", accountStatus, mustResetPassword: false });
    const response = await request(app()).post("/api/auth/login").send({ email: "user@example.test", password: "OldPassword1" });
    expect(response.status).toBe(403);
    expect(response.body.code).toBe("ACCOUNT_INACTIVE");
  });
});
