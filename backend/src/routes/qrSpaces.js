import { Router } from "express";
import { z } from "zod";
import {
  createQRUploadSpace,
  deleteQRUploadSpace,
  disableQRUploadSpace,
  getQRUploadSpaceById,
  listQRUploadSpaces,
  qrSpaceToDataUrl,
  updateQRUploadSpace
} from "../services/qrSpaceService.js";

const router = Router();

const qrSpaceSchema = z.object({
  title: z.string().min(2).max(160),
  targetType: z.enum(["general", "event", "trip", "album", "location"]).default("general"),
  targetId: z.string().optional().nullable(),
  visibility: z.enum(["public", "private", "unlisted"]).default("unlisted"),
  expiresAt: z.string().datetime().optional().nullable(),
  allowGuests: z.boolean().optional(),
  allowRegisteredUsers: z.boolean().optional(),
  requireApproval: z.boolean().optional(),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  locationName: z.string().max(160).optional().nullable(),
  metadata: z.any().optional()
});

router.get("/", async (req, res, next) => {
  try {
    const qrSpaces = await listQRUploadSpaces({ user: req.user });
    res.json({ qrSpaces });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const data = qrSpaceSchema.parse(req.body || {});
    const qrSpace = await createQRUploadSpace(data, { user: req.user });
    const qrDataUrl = await qrSpaceToDataUrl(qrSpace);
    res.status(201).json({
      qrSpace,
      publicUrl: qrSpace.publicUrl,
      uploadUrl: qrSpace.uploadUrl,
      qrDataUrl
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const qrSpace = await getQRUploadSpaceById(req.params.id, { user: req.user });
    res.json({ qrSpace });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const data = qrSpaceSchema.partial().parse(req.body || {});
    const qrSpace = await updateQRUploadSpace(req.params.id, data, { user: req.user });
    res.json({ qrSpace });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const qrSpace = req.query.mode === "delete"
      ? await deleteQRUploadSpace(req.params.id, { user: req.user })
      : await disableQRUploadSpace(req.params.id, { user: req.user });
    res.json({ qrSpace });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/qr", async (req, res, next) => {
  try {
    const qrSpace = await getQRUploadSpaceById(req.params.id, { user: req.user });
    const qrDataUrl = await qrSpaceToDataUrl(qrSpace);
    res.json({
      qrSpace,
      publicUrl: qrSpace.publicUrl,
      uploadUrl: qrSpace.uploadUrl,
      qrDataUrl
    });
  } catch (error) {
    next(error);
  }
});

export default router;
