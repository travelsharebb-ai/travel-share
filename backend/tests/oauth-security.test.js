import crypto from "node:crypto";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureBasicSkinUnlocks: vi.fn(),
  userUpsert: vi.fn()
}));

vi.mock("../src/utils/prisma.js", () => ({
  prisma: {
    user: { upsert: mocks.userUpsert }
  }
}));

vi.mock("../src/utils/skins.js", () => ({
  ensureBasicSkinUnlocks: mocks.ensureBasicSkinUnlocks
}));

import authRoutes from "../src/routes/auth.js";

const app = express();
app.use(express.json());
app.use("/api/auth", authRoutes);

const frontendOrigin = "http://frontend.test";
const safeUser = {
  id: "oauth-user",
  name: "OAuth User",
  email: "oauth@example.test",
  role: "tourist"
};

function callbackUrl(location) {
  return new URL(location, frontendOrigin);
}

function cookieHeader(response) {
  return response.headers["set-cookie"]?.map((cookie) => cookie.split(";")[0]).join("; ") || "";
}

async function startOAuth(provider = "google", redirect) {
  const path = `/api/auth/oauth/${provider}${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ""}`;
  const response = await request(app).get(path);
  const providerUrl = new URL(response.headers.location);
  return { response, providerUrl, state: providerUrl.searchParams.get("state") };
}

beforeEach(() => {
  vi.restoreAllMocks();
  process.env.JWT_SECRET = "oauth-security-test-secret";
  process.env.FRONTEND_URL = frontendOrigin;
  process.env.BACKEND_URL = "http://backend.test";
  process.env.GOOGLE_CLIENT_ID = "google-client";
  process.env.GOOGLE_CLIENT_SECRET = "google-secret";
  process.env.MICROSOFT_CLIENT_ID = "microsoft-client";
  process.env.MICROSOFT_CLIENT_SECRET = "microsoft-secret";
  mocks.ensureBasicSkinUnlocks.mockResolvedValue(undefined);
  mocks.userUpsert.mockResolvedValue(safeUser);
});

describe("OAuth security flow", () => {
  it.each(["google", "microsoft"])("creates signed, cookie-bound PKCE state for %s", async (provider) => {
    const { response, providerUrl, state } = await startOAuth(provider, "/settings?tab=profile");

    expect(response.status).toBe(302);
    expect(providerUrl.searchParams.get("code_challenge_method")).toBe("S256");
    expect(providerUrl.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const payload = jwt.verify(state, process.env.JWT_SECRET);
    expect(payload.provider).toBe(provider);
    expect(payload.nonce).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(payload.redirect).toBe("/settings?tab=profile");
    expect(payload.expiresAt).toBeGreaterThan(Date.now());
    expect(payload.exp).toBeGreaterThan(payload.iat);
    expect(response.headers["set-cookie"][0]).toContain(`ts_oauth_${provider}=${payload.nonce}`);
    expect(response.headers["set-cookie"][0]).toContain("HttpOnly");
    expect(response.headers["set-cookie"][0]).toContain("SameSite=Lax");
  });

  it("rejects missing, invalid, expired, and provider-mismatched state safely", async () => {
    const missing = await request(app).get("/api/auth/oauth/google/callback?code=test-code");
    expect(callbackUrl(missing.headers.location).searchParams.get("error")).toContain("could not be verified");

    const invalid = await request(app)
      .get("/api/auth/oauth/google/callback?code=test-code&state=invalid-state")
      .set("Cookie", "ts_oauth_google=invalid-nonce");
    expect(callbackUrl(invalid.headers.location).searchParams.get("error")).toContain("could not be verified");

    const expiredState = jwt.sign(
      { provider: "google", nonce: "expired-nonce", expiresAt: Date.now() - 1000 },
      process.env.JWT_SECRET,
      { expiresIn: -1 }
    );
    const expired = await request(app)
      .get(`/api/auth/oauth/google/callback?code=test-code&state=${encodeURIComponent(expiredState)}`)
      .set("Cookie", "ts_oauth_google=expired-nonce");
    expect(callbackUrl(expired.headers.location).searchParams.get("error")).toContain("expired");

    const mismatchState = jwt.sign(
      { provider: "google", nonce: "mismatch-nonce", expiresAt: Date.now() + 60_000 },
      process.env.JWT_SECRET,
      { expiresIn: "1m" }
    );
    const mismatch = await request(app)
      .get(`/api/auth/oauth/microsoft/callback?code=test-code&state=${encodeURIComponent(mismatchState)}`)
      .set("Cookie", "ts_oauth_microsoft=mismatch-nonce");
    expect(callbackUrl(mismatch.headers.location).searchParams.get("error")).toContain("provider mismatch");
  });

  it("uses a token-free, one-time handoff and sends the PKCE verifier", async () => {
    const { response: start, providerUrl, state } = await startOAuth("google", "https://example.com/steal");
    const challenge = providerUrl.searchParams.get("code_challenge");
    expect(jwt.verify(state, process.env.JWT_SECRET).redirect).toBeNull();

    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "provider-token" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ email: safeUser.email, name: safeUser.name }) });

    const callback = await request(app)
      .get(`/api/auth/oauth/google/callback?code=provider-code&state=${encodeURIComponent(state)}`)
      .set("Cookie", cookieHeader(start));

    expect(callback.status).toBe(302);
    const frontendUrl = callbackUrl(callback.headers.location);
    expect(frontendUrl.searchParams.has("code")).toBe(true);
    expect(frontendUrl.searchParams.has("token")).toBe(false);
    expect(frontendUrl.searchParams.has("user")).toBe(false);
    expect(frontendUrl.searchParams.has("redirect")).toBe(false);

    const stateReplay = await request(app)
      .get(`/api/auth/oauth/google/callback?code=provider-code&state=${encodeURIComponent(state)}`)
      .set("Cookie", cookieHeader(start));
    expect(callbackUrl(stateReplay.headers.location).searchParams.get("error")).toContain("could not be verified");

    const tokenRequestBody = fetchMock.mock.calls[0][1].body;
    const verifier = tokenRequestBody.get("code_verifier");
    expect(crypto.createHash("sha256").update(verifier).digest("base64url")).toBe(challenge);

    const handoffCode = frontendUrl.searchParams.get("code");
    const exchange = await request(app).post("/api/auth/oauth/exchange").send({ code: handoffCode });
    expect(exchange.status).toBe(200);
    expect(exchange.headers["cache-control"]).toBe("no-store");
    expect(exchange.body.user).toEqual({ ...safeUser, hasLocalPassword: false });
    expect(exchange.body.user).not.toHaveProperty("passwordHash");
    expect(mocks.userUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ passwordHash: null }),
      select: expect.objectContaining({ passwordHash: true })
    }));
    expect(exchange.body.token).toEqual(expect.any(String));
    expect(exchange.body.redirect).toBeNull();

    const replay = await request(app).post("/api/auth/oauth/exchange").send({ code: handoffCode });
    expect(replay.status).toBe(400);
    expect(replay.body.error).toContain("already used");
  });

  it("returns provider-unavailable users to a safe frontend error page", async () => {
    delete process.env.GOOGLE_CLIENT_SECRET;
    const response = await request(app).get("/api/auth/oauth/google");
    const frontendUrl = callbackUrl(response.headers.location);

    expect(response.status).toBe(302);
    expect(frontendUrl.origin).toBe(frontendOrigin);
    expect(frontendUrl.pathname).toBe("/oauth/callback");
    expect(frontendUrl.searchParams.get("error")).toContain("temporarily unavailable");
  });
});
