import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import authRoutes from "./routes/auth.js";
import tripRoutes from "./routes/trips.js";
import publicRoutes from "./routes/public.js";
import uploadRoutes from "./routes/uploads.js";
import locationRoutes from "./routes/locations.js";
import adminRoutes from "./routes/admin.js";
import eventRoutes from "./routes/events.js";
import storeRoutes from "./routes/store.js";
import downloadRoutes from "./routes/downloads.js";
import skinRoutes from "./routes/skins.js";
import geocodeRoutes from "./routes/geocode.js";
import { requireAdmin, requireAuth, requireOrganizerOrAdmin } from "./middleware/auth.js";
import requestLogger from "./middleware/requestLogger.js";
import diagnostics from "./utils/diagnostics.js";

export function createApp() {
  const app = express();
  const corsOrigin = process.env.CORS_ORIGIN || process.env.FRONTEND_URL || "http://localhost:5173";
  const allowedOrigins = corsOrigin.split(",").map((origin) => origin.trim());

  app.set("trust proxy", 1);
  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin)) return callback(null, true);
      // Provide a clearer, exposed 403 error and log the blocked origin to server logs
      console.warn("CORS blocked origin:", origin, "allowed:", allowedOrigins);
      const err = new Error("Origin not allowed by CORS.");
      err.status = 403;
      err.expose = true;
      return callback(err);
    },
    credentials: true
  }));
  app.use(express.json({ limit: "2mb" }));
  // Prefer serving a built frontend at `frontend/dist` when present (avoids copying)
  const frontendDist = path.resolve(process.cwd(), "frontend", "dist");
  if (fs.existsSync && fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    // SPA fallback: serve index.html for non-API routes so client-side routing works
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/uploads") || req.path.startsWith("/assets")) return next();
      res.sendFile(path.join(frontendDist, "index.html"));
    });
  }

  // Legacy/public static directory (kept for deployments that copy build into `public`)
  app.use(express.static(path.resolve(process.cwd(), "public")));
  app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));
  // Serve skin and other assets under /assets
  app.use("/assets", express.static(path.resolve(process.cwd(), "public", "assets")));

  app.get("/health", async (_req, res) => {
    // Basic health summary. Do not expose secrets. Provide DB & migration status.
    const db = await diagnostics.checkDbConnection();
    const migrations = await diagnostics.compareMigrations().catch(() => ({ ok: true }));
    const status = {
      ok: db.ok === true,
      app: process.env.APP_NAME || "Travel Share",
      db: db.ok ? 'ok' : `error: ${db.error}`,
      migrations: migrations.ok ? { missingInDb: migrations.missingInDb || [], extraInDb: migrations.extraInDb || [] } : { error: migrations.error }
    };
    res.json(status);
  });

  // Add a lightweight request logger for diagnostics (non-intrusive)
  app.use(requestLogger);

  app.use("/api/auth", authRoutes);
  app.use("/api/public", publicRoutes);
  app.use("/api/skins", skinRoutes);
  // Public geocode proxy (optional — requires MAPBOX_TOKEN or platform setting 'mapboxToken')
  app.use("/api/geocode", geocodeRoutes);
  app.use("/api/trips", requireAuth, tripRoutes);
  app.use("/api/events", requireAuth, requireOrganizerOrAdmin, eventRoutes);
  // Allow read-only access to locations for the public map UI; write operations still require auth inside the routes.
  app.use("/api/locations", locationRoutes);
  app.use("/api/store", requireAuth, storeRoutes);
  app.use("/api/downloads", downloadRoutes);
  app.use("/api", requireAuth, uploadRoutes);
  app.use("/api/admin", requireAuth, requireAdmin, adminRoutes);

  app.use((error, _req, res, _next) => {
    if (error.name === "ZodError") {
      const detail = error.errors?.[0];
      const field = detail?.path?.join(".");
      const message = field ? `${field}: ${detail.message}` : detail?.message;
      return res.status(400).json({ error: message || "Invalid request.", details: error.errors });
    }
    if (error.code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: "File is too large." });
    const status = error.status || 500;
    const operational = error.expose || ["StorageError", "UploadError"].includes(error.name);
    res.status(status).json({ error: status === 500 && !operational ? "Something went wrong." : error.message });
  });

  return app;
}
