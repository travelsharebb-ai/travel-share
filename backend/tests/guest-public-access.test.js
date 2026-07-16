import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  eventFindFirst: vi.fn(),
  eventFindMany: vi.fn(),
  guestFindUnique: vi.fn(),
  guestFindMany: vi.fn(),
  guestUpdate: vi.fn(),
  guestPinResetFindUnique: vi.fn(),
  guestPinResetUpdate: vi.fn(),
  guestPinResetUpdateMany: vi.fn(),
  getOrCreateGuestSession: vi.fn(),
  getGuestLifecycle: vi.fn()
}));

vi.mock("../src/utils/prisma.js", () => ({
  prisma: {
    event: {
      findFirst: mocks.eventFindFirst,
      findMany: mocks.eventFindMany
    },
    guestSession: {
      findUnique: mocks.guestFindUnique,
      findMany: mocks.guestFindMany,
      update: mocks.guestUpdate
    },
    guestPinResetToken: {
      findUnique: mocks.guestPinResetFindUnique,
      update: mocks.guestPinResetUpdate,
      updateMany: mocks.guestPinResetUpdateMany
    },
    $transaction: vi.fn(async (operations) => Promise.all(operations))
  }
}));

vi.mock("../src/services/sessionService.js", () => ({
  getOrCreateGuestSession: mocks.getOrCreateGuestSession,
  getGuestLifecycle: mocks.getGuestLifecycle,
  getOrCreateCreatorSession: vi.fn(),
  findCreatorSession: vi.fn()
}));

const {
  guestSessionCreate,
  guestSessionResume,
  guestPinChange,
  guestPinReset,
  publicEventDetails
} = await import("../src/controllers/publicController.js");
const { requireOrganizerOrAdmin } = await import("../src/middleware/auth.js");
const { isGuestRole, navigationItemsForRole } = await import("../../frontend/src/lib/navigation.js");

function testRequest({ body = {}, params = {}, headers = {} } = {}) {
  const normalized = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
  return {
    body,
    params,
    ip: "127.0.0.1",
    platformCache: new Map(),
    get(name) { return normalized[name.toLowerCase()] || ""; }
  };
}

function testResponse() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; }
  };
}

async function invoke(handler, req) {
  const res = testResponse();
  await handler(req, res, (error) => {
    res.status(error?.name === "ZodError" ? 400 : error?.status || 500).json({
      error: error?.name === "ZodError" ? "Invalid request." : error?.message || "Failed."
    });
  });
  return res;
}

function activeLifecycle() {
  return {
    state: "active",
    activeUntil: new Date(Date.now() + 2 * 86400000),
    expiresAt: new Date(Date.now() + 13 * 86400000),
    daysRemaining: 13,
    shouldPromptRegister: true,
    expired: false
  };
}

function guestRecord(overrides = {}) {
  return {
    id: "guest-1",
    token: "guest-session-secret",
    displayName: "Asha Guest",
    resumeCode: null,
    passcodeHash: null,
    claimedById: null,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 13 * 86400000),
    ...overrides
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getGuestLifecycle.mockResolvedValue(activeLifecycle());
  mocks.getOrCreateGuestSession.mockResolvedValue(guestRecord());
  mocks.guestUpdate.mockResolvedValue(guestRecord());
  mocks.guestFindUnique.mockResolvedValue(guestRecord());
  mocks.guestFindMany.mockResolvedValue([]);
  mocks.guestPinResetUpdate.mockResolvedValue({});
  mocks.guestPinResetUpdateMany.mockResolvedValue({ count: 0 });
});

describe("guest PIN settings and recovery", () => {
  it("changes an authenticated guest PIN without returning secrets", async () => {
    const passcodeHash = await bcrypt.hash("4826", 4);
    mocks.guestFindUnique.mockResolvedValue(guestRecord({ passcodeHash }));
    const response = await invoke(guestPinChange, testRequest({
      headers: { "x-guest-token": "guest-session-secret" },
      body: { currentPin: "4826", newPin: "7391", confirmPin: "7391" }
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body).not.toHaveProperty("token");
    expect(response.body).not.toHaveProperty("passcodeHash");
    const saved = mocks.guestUpdate.mock.calls[0][0].data;
    expect(await bcrypt.compare("7391", saved.passcodeHash)).toBe(true);
    expect(await bcrypt.compare("4826", saved.passcodeHash)).toBe(false);
  });

  it("rejects wrong current PIN, invalid PIN, mismatched PIN, and unauthenticated changes", async () => {
    const passcodeHash = await bcrypt.hash("4826", 4);
    mocks.guestFindUnique.mockResolvedValue(guestRecord({ passcodeHash }));
    const wrong = await invoke(guestPinChange, testRequest({ headers: { "x-guest-token": "guest-session-secret" }, body: { currentPin: "0000", newPin: "7391", confirmPin: "7391" } }));
    const invalid = await invoke(guestPinChange, testRequest({ headers: { "x-guest-token": "guest-session-secret" }, body: { currentPin: "4826", newPin: "73910", confirmPin: "73910" } }));
    const mismatch = await invoke(guestPinChange, testRequest({ headers: { "x-guest-token": "guest-session-secret" }, body: { currentPin: "4826", newPin: "7391", confirmPin: "7392" } }));
    const unauthenticated = await invoke(guestPinChange, testRequest({ body: { currentPin: "4826", newPin: "7391", confirmPin: "7391" } }));

    expect(wrong.statusCode).toBe(403);
    expect(invalid.statusCode).toBe(400);
    expect(mismatch.statusCode).toBe(400);
    expect(unauthenticated.statusCode).toBe(401);
  });

  it("consumes an admin-generated recovery link once and saves only a new PIN hash", async () => {
    const recovery = { id: "recovery-1", guestSessionId: "guest-1", usedAt: null, revokedAt: null, expiresAt: new Date(Date.now() + 60000) };
    mocks.guestPinResetFindUnique.mockResolvedValue(recovery);
    mocks.guestFindUnique.mockResolvedValue(guestRecord({ passcodeHash: await bcrypt.hash("4826", 4), pinResetRequired: true }));
    const response = await invoke(guestPinReset, testRequest({ body: {
      token: "https://travel-share.example/guest/reset-pin/recovery-secret",
      newPin: "7391",
      confirmPin: "7391"
    } }));

    expect(response.statusCode).toBe(200);
    expect(response.body).not.toHaveProperty("token");
    expect(mocks.guestPinResetUpdate).toHaveBeenCalledWith({ where: { id: "recovery-1" }, data: { usedAt: expect.any(Date) } });
    expect(await bcrypt.compare("7391", mocks.guestUpdate.mock.calls[0][0].data.passcodeHash)).toBe(true);
    expect(await bcrypt.compare("4826", mocks.guestUpdate.mock.calls[0][0].data.passcodeHash)).toBe(false);
  });

  it.each([
    ["unknown", null],
    ["expired", { usedAt: null, revokedAt: null, expiresAt: new Date(Date.now() - 1000) }],
    ["revoked", { usedAt: null, revokedAt: new Date(), expiresAt: new Date(Date.now() + 60000) }],
    ["used", { usedAt: new Date(), revokedAt: null, expiresAt: new Date(Date.now() + 60000) }]
  ])("rejects a %s recovery token", async (_label, state) => {
    mocks.guestPinResetFindUnique.mockResolvedValue(state ? { id: "recovery-1", guestSessionId: "guest-1", ...state } : null);
    const response = await invoke(guestPinReset, testRequest({ body: { token: "recovery-secret", newPin: "7391", confirmPin: "7391" } }));
    expect(response.statusCode).toBe(400);
    expect(mocks.guestUpdate).not.toHaveBeenCalled();
  });

  it("does not allow name-only PIN reset", async () => {
    const response = await invoke(guestPinReset, testRequest({ body: { displayName: "Asha Guest", newPin: "7391", confirmPin: "7391" } }));
    expect(response.statusCode).toBe(400);
  });

  it("blocks normal resume while an administrator requires a new PIN", async () => {
    const passcodeHash = await bcrypt.hash("4826", 4);
    mocks.guestFindMany.mockResolvedValue([]);
    mocks.guestFindUnique.mockResolvedValue(guestRecord({ passcodeHash, pinResetRequired: true }));
    const response = await invoke(guestSessionResume, testRequest({ body: { resumeToken: "raw-resume-token", passcode: "4826" } }));
    expect(response.statusCode).toBe(401);
    expect(mocks.guestUpdate).not.toHaveBeenCalled();
  });
});

describe("guest session name and PIN access", () => {
  it("creates a guest session with a name and hashed 4-digit PIN", async () => {
    const response = await invoke(guestSessionCreate, testRequest({
      body: { displayName: "Asha Guest", passcode: "4826" }
    }));

    expect(response.statusCode).toBe(201);
    expect(response.body.guestSession.token).toBe("guest-session-secret");
    expect(response.body.resumeToken).toBeTruthy();
    const saved = mocks.guestUpdate.mock.calls[0][0].data;
    expect(saved.displayName).toBe("Asha Guest");
    expect(saved.passcodeHash).not.toBe("4826");
    expect(await bcrypt.compare("4826", saved.passcodeHash)).toBe(true);
  });

  it("rejects missing or invalid PINs before creating a guest session", async () => {
    const missing = await invoke(guestSessionCreate, testRequest({ body: { displayName: "Asha Guest" } }));
    const invalid = await invoke(guestSessionCreate, testRequest({
      body: { displayName: "Asha Guest", passcode: "12345" }
    }));

    expect(missing.statusCode).toBe(400);
    expect(invalid.statusCode).toBe(400);

    expect(mocks.getOrCreateGuestSession).not.toHaveBeenCalled();
  });

  it("resumes an existing guest session by case-insensitive name and PIN", async () => {
    const passcodeHash = await bcrypt.hash("4826", 4);
    mocks.guestFindMany.mockResolvedValue([guestRecord({ passcodeHash })]);

    const response = await invoke(guestSessionResume, testRequest({
      body: { displayName: "asha guest", passcode: "4826" }
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body.guestToken).toBe("guest-session-secret");
    expect(mocks.guestFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        displayName: { equals: "asha guest", mode: "insensitive" },
        claimedById: null
      }),
      take: 20
    }));
  });

  it("resumes an existing guest session by raw token and PIN", async () => {
    const passcodeHash = await bcrypt.hash("4826", 4);
    mocks.guestFindUnique.mockResolvedValue(guestRecord({ passcodeHash }));

    const response = await invoke(guestSessionResume, testRequest({
      body: { resumeToken: "raw-resume-token", passcode: "4826" }
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body.guestToken).toBe("guest-session-secret");
    expect(mocks.guestFindUnique).toHaveBeenCalledWith({
      where: { resumeTokenHash: "7bec36934175128395b377ef19713d88932594be0dd79f02f0d01bc9abac8ee5" }
    });
  });

  it("extracts a token from a full guest access link and still requires the PIN", async () => {
    const passcodeHash = await bcrypt.hash("4826", 4);
    mocks.guestFindUnique.mockResolvedValue(guestRecord({ passcodeHash }));

    const response = await invoke(guestSessionResume, testRequest({
      body: {
        linkToken: "https://travel-share.example/guest/access/raw-resume-token?utm_source=saved",
        pin: "4826"
      }
    }));

    expect(response.statusCode).toBe(200);
    expect(mocks.guestFindUnique).toHaveBeenCalledWith({
      where: { resumeTokenHash: "7bec36934175128395b377ef19713d88932594be0dd79f02f0d01bc9abac8ee5" }
    });
  });

  it("rejects the wrong guest PIN", async () => {
    const passcodeHash = await bcrypt.hash("4826", 4);
    mocks.guestFindMany.mockResolvedValue([guestRecord({ passcodeHash })]);

    const response = await invoke(guestSessionResume, testRequest({
      body: { displayName: "Asha Guest", passcode: "0000" }
    }));

    expect(response.statusCode).toBe(401);
    expect(response.body.error).toBe("Invalid guest name or PIN.");
    expect(mocks.guestUpdate).not.toHaveBeenCalled();
  });

  it("rejects the wrong PIN for token resume", async () => {
    const passcodeHash = await bcrypt.hash("4826", 4);
    mocks.guestFindUnique.mockResolvedValue(guestRecord({ passcodeHash }));

    const response = await invoke(guestSessionResume, testRequest({
      body: { accessToken: "raw-resume-token", pin: "0000" }
    }));

    expect(response.statusCode).toBe(401);
    expect(response.body.error).toBe("Invalid guest name or PIN.");
    expect(mocks.guestUpdate).not.toHaveBeenCalled();
  });

  it("rejects missing PIN and missing name/token", async () => {
    const missingPin = await invoke(guestSessionResume, testRequest({
      body: { resumeToken: "raw-resume-token" }
    }));
    const missingIdentifier = await invoke(guestSessionResume, testRequest({
      body: { passcode: "4826" }
    }));

    expect(missingPin.statusCode).toBe(400);
    expect(missingIdentifier.statusCode).toBe(400);
    expect(mocks.guestUpdate).not.toHaveBeenCalled();
  });
});

describe("public event detail privacy", () => {
  const publicEvent = {
    id: "event-public",
    title: "Public Festival",
    visibility: "public",
    status: "live",
    uploads: [],
    zones: [],
    _count: { uploads: 0, zones: 0 }
  };

  it.each([
    ["guest", {}],
    ["tourist", { Authorization: "Bearer tourist-token" }]
  ])("allows a %s to load safe public event detail", async (_role, headers) => {
    mocks.eventFindFirst.mockResolvedValue(publicEvent);

    const response = await invoke(publicEventDetails, testRequest({
      params: { eventId: "event-public" },
      headers
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body.event).toMatchObject({ id: "event-public", title: "Public Festival" });
    const query = mocks.eventFindFirst.mock.calls[0][0];
    expect(query.where).toEqual({ id: "event-public", visibility: "public", status: "live" });
    expect(query.select.qrToken).toBeUndefined();
    expect(query.select.organizerId).toBeUndefined();
    expect(query.select.guestSessionId).toBeUndefined();
    expect(query.select.uploads.where).toEqual({ status: "approved" });
  });

  it("keeps private, draft, and owner-only event detail unavailable publicly", async () => {
    mocks.eventFindFirst.mockResolvedValue(null);

    const response = await invoke(publicEventDetails, testRequest({ params: { eventId: "event-private" } }));

    expect(response.statusCode).toBe(404);
    expect(response.body.error).toContain("private or unavailable");
    expect(mocks.eventFindFirst.mock.calls[0][0].where).toEqual({
      id: "event-private",
      visibility: "public",
      status: "live"
    });
  });

  it("keeps organizer management access blocked for tourists", async () => {
    const res = testResponse();
    let allowed = false;
    requireOrganizerOrAdmin(
      { user: { id: "tourist-1", role: "tourist" } },
      res,
      () => { allowed = true; }
    );

    expect(res.statusCode).toBe(403);
    expect(allowed).toBe(false);
  });
});

describe("guest navigation parity", () => {
  it("derives guest state safely from the current session user", () => {
    expect(isGuestRole({ role: "guest" })).toBe(true);
    expect(isGuestRole({ role: "tourist" })).toBe(false);
    expect(isGuestRole(null)).toBe(false);
  });

  it("includes every registered-tourist destination without admin access", () => {
    const tourist = navigationItemsForRole("tourist");
    const guest = navigationItemsForRole("guest");

    expect(guest).toEqual(tourist);
    expect(guest.map((item) => item.id)).toEqual([
      "dashboard", "tourist", "trips", "map", "events", "qrSpaces", "scan",
      "myUploads", "approvals", "sharedAlbums", "store", "settings"
    ]);
    expect(guest.some((item) => item.id === "admin")).toBe(false);
  });
});
