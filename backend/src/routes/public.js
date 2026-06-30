import { Router } from "express";
import multer from "multer";
import { uploadLimiter } from "../middleware/rateLimits.js";
import * as publicController from "../controllers/publicController.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

/**
 * ======================
 * CORE PUBLIC API
 * ======================
 */

// system
router.get("/settings", publicController.settings);
router.get("/appearance", publicController.appearance);

// public map/events feed
router.get("/events", publicController.publicEvents);
router.get("/store-preview", publicController.storePreview);

// =======================
// 🔥 SINGLE QR ENTRY POINT
// =======================

router.get("/qr/:qrToken", publicController.qrGet);

router.post(
  "/qr/:qrToken/uploads",
  uploadLimiter,
  upload.single("file"),
  publicController.handleQrUpload
);

// legacy fallback (keep for old links)
// ❌ LEGACY (DEPRECATED - REMOVE LATER)
// router.get("/event/:qrToken", publicController.eventGet);
router.post(
  "/event/:qrToken/uploads",
  uploadLimiter,
  upload.single("file"),
  publicController.handleEventUpload
);

// zone fallback
// router.get("/zone/:qrToken", publicController.zoneGet);
router.post(
  "/zone/:qrToken/uploads",
  uploadLimiter,
  upload.single("file"),
  publicController.handleZoneUpload
);

export default router;