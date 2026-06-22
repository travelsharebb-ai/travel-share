import { prisma } from "../utils/prisma.js";
import { secureToken } from "../utils/tokens.js";
import { get as platformGet } from "./platformService.js";

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
  if (existing && existing.expiresAt > new Date()) {
    return existing;
  }

  const guestAccessDays = Number(await platformGet(platformCache, "guestAccessDays", process.env.GUEST_ACCESS_DAYS || 3)) || 3;
  const expiresAt = new Date(Date.now() + guestAccessDays * 24 * 60 * 60 * 1000);

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
  try {
    if (token) existing = await prisma.guestSession.findUnique({ where: { token } });
  } catch (err) {
    console.warn("getOrCreateCreatorSession - findUnique failed", err?.message || err);
    existing = null;
  }
  if (existing && existing.expiresAt > new Date() && !existing.claimedById) {
    return existing;
  }

  const guestAccessDays = Number(await platformGet(platformCache, "guestAccessDays", process.env.GUEST_ACCESS_DAYS || 3)) || 3;
  try {
    const session = await prisma.guestSession.create({
      data: {
        token: secureToken(24),
        deviceFingerprint: deviceFingerprint || null,
        scopeType: "creator",
        scopeId: "creator",
        expiresAt: new Date(Date.now() + guestAccessDays * 24 * 60 * 60 * 1000)
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
    if (session.expiresAt <= new Date()) {
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
