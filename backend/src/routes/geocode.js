import { Router } from "express";
import { prisma } from "../utils/prisma.js";

const router = Router();
import { uploadLimiter } from "../middleware/rateLimits.js";

// Helper to resolve token from env or platform setting
async function resolveToken() {
  const fromEnv = process.env.MAPBOX_TOKEN;
  if (fromEnv) return fromEnv;
  const setting = await prisma.platformSetting.findUnique({ where: { key: "mapboxToken" } }).catch(() => null);
  return setting?.value || null;
}

// Proxy search (autocomplete)
router.get("/search", uploadLimiter, async (req, res) => {
  try {
    const q = req.query.q || req.query.query || "";
    if (!q) return res.status(400).json({ error: "Missing query parameter 'q'." });
    const token = await resolveToken();
    if (!token) return res.status(501).json({ error: "Geocode proxy not configured." });
    const limit = Number(req.query.limit || 6);
    const autocomplete = req.query.autocomplete === "false" ? "false" : "true";
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${encodeURIComponent(token)}&autocomplete=${autocomplete}&limit=${encodeURIComponent(limit)}`;
    const resp = await fetch(url);
    const data = await resp.json();
    res.status(resp.status).json(data);
  } catch (err) {
    console.error("Geocode search error", err);
    res.status(500).json({ error: "Geocode proxy error" });
  }
});

// Proxy reverse geocode
router.get("/reverse", uploadLimiter, async (req, res) => {
  try {
    const lat = req.query.lat;
    const lng = req.query.lng || req.query.lon || req.query.lon;
    if (!lat || !lng) return res.status(400).json({ error: "Missing lat/lng query parameters." });
    const token = await resolveToken();
    if (!token) return res.status(501).json({ error: "Geocode proxy not configured." });
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(lng)},${encodeURIComponent(lat)}.json?access_token=${encodeURIComponent(token)}&limit=1`;
    const resp = await fetch(url);
    const data = await resp.json();
    res.status(resp.status).json(data);
  } catch (err) {
    console.error("Geocode reverse error", err);
    res.status(500).json({ error: "Geocode proxy error" });
  }
});

export default router;
