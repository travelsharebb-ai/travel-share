import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import tripRoutes from "./routes/trips.js";
import publicRoutes from "./routes/public.js";
import uploadRoutes from "./routes/uploads.js";
import adminRoutes from "./routes/admin.js";
import { requireAdmin, requireAuth } from "./middleware/auth.js";

export function createApp() {
  const app = express();
  const corsOrigin = process.env.CORS_ORIGIN || process.env.FRONTEND_URL || "http://localhost:5173";

  app.set("trust proxy", 1);
  app.use(cors({ origin: corsOrigin.split(",").map((origin) => origin.trim()), credentials: true }));
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, app: process.env.APP_NAME || "Travel Share" });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/public", publicRoutes);
  app.use("/api/trips", requireAuth, tripRoutes);
  app.use("/api", requireAuth, uploadRoutes);
  app.use("/api/admin", requireAuth, requireAdmin, adminRoutes);

  app.use((error, _req, res, _next) => {
    if (error.name === "ZodError") return res.status(400).json({ error: "Invalid request.", details: error.errors });
    if (error.code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: "File is too large." });
    const status = error.status || 500;
    res.status(status).json({ error: status === 500 ? "Something went wrong." : error.message });
  });

  return app;
}
