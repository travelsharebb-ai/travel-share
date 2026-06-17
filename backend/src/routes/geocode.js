import { Router } from "express";
import { prisma } from "../utils/prisma.js";

const router = Router();
import { geocodeLimiter } from "../middleware/rateLimits.js";

// Small in-memory cache to reduce Mapbox calls: simple TTL cache with size cap
const CACHE_TTL_MS = 60 * 1000; // 60s
const CACHE_MAX = 500;
const cache = new Map();

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key, value) {
  if (cache.size >= CACHE_MAX) {
    // simple eviction: remove first inserted (Map preserves insertion order)
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(key, { ts: Date.now(), value });
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
