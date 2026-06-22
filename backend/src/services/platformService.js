import { prisma } from "../utils/prisma.js";

// per-request cache (controller should pass a Map-like cache object)
const CACHE_TTL = 60 * 1000; // 60 seconds

function ensureCache(cache) {
  if (!cache || typeof cache.get !== 'function' || typeof cache.set !== 'function') return new Map();
  return cache;
}

export async function get(cache, key, fallback) {
  try {
    const platformCache = ensureCache(cache);
    const existing = platformCache.get(key);
    if (existing && existing.expiresAt && existing.expiresAt > Date.now()) {
      return existing.value;
    }

    let record = null;
    try {
      record = await prisma.platformSetting.findUnique({ where: { key } });
    } catch (err) {
      console.warn('platformSetting.findUnique failed', err?.message || err);
      record = null;
    }
    const value = record?.value ?? fallback;
    platformCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL });
    return value;
  } catch (err) {
    return fallback;
  }
}
