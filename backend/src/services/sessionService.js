import { prisma } from "../utils/prisma.js";
import { secureToken } from "../utils/tokens.js";
import { get as platformGet } from "./platformService.js";

const DEFAULT_GUEST_ACCESS_DAYS = 3;
const DEFAULT_GUEST_DELETION_DAYS = 14;

function toDate(value) {
  return value instanceof Date ? value : new Date(value);
}

export async function getGuestLifecycle(guestSession, settings = {}) {
  const guestAccessDays = Number(settings.guestAccessDays ?? await platformGet(settings.platformCache, "guestAccessDays", process.env.GUEST_ACCESS_DAYS || DEFAULT_GUEST_ACCESS_DAYS)) || DEFAULT_GUEST_ACCESS_DAYS;
  const guestDeletionDays = Number(settings.guestDeletionDays ?? await platformGet(settings.platformCache, "guestDeletionDays", process.env.GUEST_DELETION_DAYS || DEFAULT_GUEST_DELETION_DAYS)) || DEFAULT_GUEST_DELETION_DAYS;
  const createdAt = toDate(guestSession.createdAt);
  const activeUntil = new Date(createdAt.getTime() + guestAccessDays * 24 * 60 * 60 * 1000);
  const impliedExpiresAt = new Date(createdAt.getTime() + guestDeletionDays * 24 * 60 * 60 * 1000);
  const actualExpiresAt = guestSession.expiresAt ? toDate(guestSession.expiresAt) : impliedExpiresAt;
  const expiresAt = new Date(Math.max(impliedExpiresAt.getTime(), actualExpiresAt.getTime()));
  const now = new Date();
  const state = now < activeUntil ? "active" : now < expiresAt ? "grace" : "expired";
  const daysRemaining = Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
  return {
    state,
    activeUntil,
    expiresAt,
    daysRemaining,
    shouldPromptRegister: state !== "expired",
    expired: state === "expired"
  };
}

// Pure session service: does not touch req/res or cookies.
// Controllers must call these and set cookies/headers as needed.

export async function getOrCreateGuestSession({ token, deviceFingerprint, platformCache, scopeType, scopeId }) {
  let existing = null;
  try {
    if (token) existing = await prisma.guestSession.findUnique({ where: { token } });
  } catch (err) {
    console.warn("getOrCreateGuestSession - findUnique failed", err?.message || err);
    existing = null;
  }
  if (existing) {
    const lifecycle = await getGuestLifecycle(existing, { platformCache });
    if (!existing.claimedById && lifecycle.state !== "expired") {
      return existing;
    }
  }

  const guestDeletionDays = Number(await platformGet(platformCache, "guestDeletionDays", process.env.GUEST_DELETION_DAYS || DEFAULT_GUEST_DELETION_DAYS)) || DEFAULT_GUEST_DELETION_DAYS;
  const expiresAt = new Date(Date.now() + guestDeletionDays * 24 * 60 * 60 * 1000);

  try {
    const session = await prisma.guestSession.create({
      data: {
        token: secureToken(24),
        deviceFingerprint: deviceFingerprint || null,
        scopeType: scopeType || null,
        scopeId: scopeId || null,
        expiresAt
      }
    });
    return session;
  } catch (err) {
    console.error("getOrCreateGuestSession failed", err?.message || err);
    const e = new Error('Unable to create guest session');
    e.status = 503;
    throw e;
  }
}

export async function getOrCreateCreatorSession({ token, deviceFingerprint, platformCache }) {
  let existing = null;
  const guestDeletionDays = Number(await platformGet(platformCache, "guestDeletionDays", process.env.GUEST_DELETION_DAYS || DEFAULT_GUEST_DELETION_DAYS)) || DEFAULT_GUEST_DELETION_DAYS;
  try {
    if (token) existing = await prisma.guestSession.findUnique({ where: { token } });
  } catch (err) {
    console.warn("getOrCreateCreatorSession - findUnique failed", err?.message || err);
    existing = null;
  }
  if (existing) {
    const lifecycle = await getGuestLifecycle(existing, { platformCache });
    if (!existing.claimedById && lifecycle.state !== "expired") {
      return existing;
    }
  }

  try {
    const session = await prisma.guestSession.create({
      data: {
        token: secureToken(24),
        deviceFingerprint: deviceFingerprint || null,
        scopeType: "creator",
        scopeId: "creator",
        expiresAt: new Date(Date.now() + guestDeletionDays * 24 * 60 * 60 * 1000)
      }
    });
    return session;
  } catch (err) {
    console.error("getOrCreateCreatorSession failed", err?.message || err);
    const e = new Error('Unable to create guest creator session');
    e.status = 503;
    throw e;
  }
}

export async function findCreatorSession({ token }) {
  if (!token) {
    const e = new Error('Creator session token required');
    e.status = 401;
    throw e;
  }
  try {
    const session = await prisma.guestSession.findUnique({ where: { token } });
    if (!session) {
      const e = new Error('Guest creator session not found');
      e.status = 401;
      throw e;
    }
    if (session.claimedById) {
      const e = new Error('Guest creator session already claimed');
      e.status = 401;
      throw e;
    }
    const lifecycle = await getGuestLifecycle(session);
    if (lifecycle.state === "expired") {
      const e = new Error('Guest creator session expired');
      e.status = 403;
      throw e;
    }
    return session;
  } catch (err) {
    if (err.status) throw err;
    console.warn('findCreatorSession - findUnique failed', err?.message || err);
    const e = new Error('Error looking up creator session');
    e.status = 500;
    throw e;
  }
}
