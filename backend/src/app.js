import express from "express";
import cors from "cors";
import path from "node:path";
import authRoutes from "./routes/auth.js";
import tripRoutes from "./routes/trips.js";
import publicRoutes from "./routes/public.js";
import uploadRoutes from "./routes/uploads.js";
import adminRoutes from "./routes/admin.js";
import eventRoutes from "./routes/events.js";
import storeRoutes from "./routes/store.js";
import downloadRoutes from "./routes/downloads.js";
import skinRoutes from "./routes/skins.js";
import { requireAdmin, requireAuth, requireOrganizerOrAdmin } from "./middleware/auth.js";

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
  app.use(express.static(path.resolve(process.cwd(), "public")));
  app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));
  // Serve skin and other assets under /assets
  app.use("/assets", express.static(path.resolve(process.cwd(), "public", "assets")));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, app: process.env.APP_NAME || "Travel Share" });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/public", publicRoutes);
  app.use("/api/skins", skinRoutes);
  app.use("/api/trips", requireAuth, tripRoutes);
  app.use("/api/events", requireAuth, requireOrganizerOrAdmin, eventRoutes);
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
