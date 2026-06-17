import { Router } from "express";
import { prisma } from "../utils/prisma.js";

const router = Router();
import { geocodeLimiter } from "../middleware/rateLimits.js";

// Small cache layer: prefer Redis if available (REDIS_URL), otherwise in-memory TTL cache
const CACHE_TTL_MS = 60 * 1000; // 60s
const CACHE_MAX = 500;
let redisClient = null;
try {
  // optional dependency; dynamic require so local dev without ioredis still works
  // eslint-disable-next-line import/no-extraneous-dependencies, global-require
  const IORedis = require("ioredis");
  const redisUrl = process.env.REDIS_URL || process.env.REDIS_TLS_URL;
  if (redisUrl) redisClient = new IORedis(redisUrl);
} catch (err) {
  redisClient = null;
}

const memoryCache = new Map();

async function cacheGet(key) {
  if (redisClient) {
    try {
      const v = await redisClient.get(`geocode:${key}`);
      return v ? JSON.parse(v) : null;
    } catch (e) {
      // fall back to memory
    }
  }
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value;
}

async function cacheSet(key, value) {
  if (redisClient) {
    try {
      await redisClient.set(`geocode:${key}`, JSON.stringify(value), "PX", CACHE_TTL_MS);
      return;
    } catch (e) {
      // fall back to memory
    }
  }
  if (memoryCache.size >= CACHE_MAX) {
    const firstKey = memoryCache.keys().next().value;
    if (firstKey) memoryCache.delete(firstKey);
  }
  memoryCache.set(key, { ts: Date.now(), value });
}

// Helper to resolve token from env or platform setting
async function resolveToken() {
  const fromEnv = process.env.MAPBOX_TOKEN;
  if (fromEnv) return fromEnv;
  const setting = await prisma.platformSetting.findUnique({ where: { key: "mapboxToken" } }).catch(() => null);
  return setting?.value || null;
}

// Proxy search (autocomplete)
router.get("/search", geocodeLimiter, async (req, res) => {
  try {
    const q = req.query.q || req.query.query || "";
    if (!q) return res.status(400).json({ error: "Missing query parameter 'q'." });
    const token = await resolveToken();
    if (!token) return res.status(501).json({ error: "Geocode proxy not configured." });
    const limit = Number(req.query.limit || 6);
    const autocomplete = req.query.autocomplete === "false" ? "false" : "true";
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${encodeURIComponent(token)}&autocomplete=${autocomplete}&limit=${encodeURIComponent(limit)}`;
    const cacheKey = `search:${q}:${limit}:${autocomplete}`;
    const cached = cacheGet(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    const resp = await fetch(url);
    const data = await resp.json();
    if (resp.ok) cacheSet(cacheKey, data);
    res.status(resp.status).json(data);
  } catch (err) {
    console.error("Geocode search error", err);
    res.status(500).json({ error: "Geocode proxy error" });
  }
});

// Proxy reverse geocode
router.get("/reverse", geocodeLimiter, async (req, res) => {
  try {
    const lat = req.query.lat;
    const lng = req.query.lng || req.query.lon || req.query.lon;
    if (!lat || !lng) return res.status(400).json({ error: "Missing lat/lng query parameters." });
    const token = await resolveToken();
    if (!token) return res.status(501).json({ error: "Geocode proxy not configured." });
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(lng)},${encodeURIComponent(lat)}.json?access_token=${encodeURIComponent(token)}&limit=1`;
    const cacheKey = `reverse:${lat}:${lng}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);
    const resp = await fetch(url);
    const data = await resp.json();
    if (resp.ok) cacheSet(cacheKey, data);
    res.status(resp.status).json(data);
  } catch (err) {
    console.error("Geocode reverse error", err);
    res.status(500).json({ error: "Geocode proxy error" });
  }
});

export default router;
