import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import { prisma } from "../utils/prisma.js";
import { secureToken } from "../utils/tokens.js";
import { hashToken } from "../utils/tokens.js";
import bcrypt from "bcryptjs";
import { uploadMedia } from "../utils/storage.js";
import { cleanEvent, cleanGuestSession, cleanTrip, cleanUpload, cleanUser } from "../utils/exportImport.js";
import { executeAdminImport, getImportPreview } from "../utils/adminImport.js";
import { createNotification } from "../services/notifications.js";
import { getAdminAnalytics, getAdminReportingDepth } from "../services/analyticsService.js";
import { getPaymentReadiness } from "../utils/payments.js";
import { sendPasswordResetEmail } from "../utils/email.js";
import { allowDevelopmentRecoveryUrl, writeSecurityAudit } from "../services/accountSecurityService.js";

const router = Router();
const supportReasonSchema = z.object({
  action: z.string().min(1),
  reason: z.string().trim().min(5).max(1000),
  confirmation: z.boolean().optional()
});
const maxMb = Number(process.env.MAX_UPLOAD_SIZE_MB || 50);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxMb * 1024 * 1024 }
});

const adSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().max(240).optional().nullable(),
  mediaUrl: z.string().url(),
  mediaType: z.enum(["image", "video"]),
  linkUrl: z.string().url().optional().nullable(),
  active: z.boolean().optional(),
  priority: z.coerce.number().int().min(0).max(1000).optional(),
  displaySeconds: z.coerce.number().int().min(5).max(60).optional(),
  placement: z.enum(["global", "tourist", "event", "guest", "map", "upload_success"]).optional(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable()
});

const assetUrlSchema = z.string().refine((value) => {
  if (value.startsWith("/assets/") || value.startsWith("/uploads/")) return true;
  return z.string().url().safeParse(value).success;
}, "Must be a URL or an internal asset path.");

const storeItemSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional().nullable(),
  type: z.enum(["image_skin", "photo_frame", "album_theme", "event_theme", "download_asset", "premium_qr", "branded_page", "ad_free"]),
  priceCents: z.coerce.number().int().min(0).optional(),
  previewUrl: assetUrlSchema.optional().nullable(),
  active: z.boolean().optional(),
  metadata: z.any().optional().nullable()
});

const analyticsQuerySchema = z.object({
  days: z.coerce.number().int().refine((value) => [7, 30].includes(value), {
    message: "days must be 7 or 30"
  }).default(30)
});

async function settingValue(key, fallback) {
  let setting = null;
  try {
    setting = await prisma.platformSetting.findUnique({ where: { key } });
  } catch (err) {
    console.warn('platformSetting.findUnique failed', err?.message || err);
    setting = null;
  }
  return setting?.value || fallback;
}

router.get("/stats", async (_req, res) => {
  const [users, organizers, guests, trips, events, uploads, reported, ads, storeItems] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "organizer" } }),
    prisma.guestSession.count(),
    prisma.trip.count(),
    prisma.event.count(),
    prisma.upload.count(),
    prisma.upload.count({ where: { status: "reported" } }),
    prisma.internalAd.count(),
    prisma.purchaseItem.count()
  ]);
  res.json({ stats: { users, organizers, guests, trips, events, uploads, reported, ads, storeItems } });
});
router.get("/map/locations", async (_req, res, next) => {
  try {
    const locations = await prisma.location.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        address: true,
        latitude: true,
        longitude: true,
        featured: true,
        hidden: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { uploads: true } },
        uploads: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            fileUrl: true,
            fileType: true,
            caption: true,
            createdAt: true,
            tripId: true,
            eventId: true,
            latitude: true,
            longitude: true,
            approximateLatitude: true,
            approximateLongitude: true,
            locationVisibility: true,
            region: true,
            locationName: true,
            status: true,
            moderationStatus: true
          }
        }
      },
      take: 200
    });
    res.json({ locations });
  } catch (error) {
    next(error);
  }
});

router.get("/map/locations/:locationId", async (req, res, next) => {
  try {
    const location = await prisma.location.findUnique({
      where: { id: req.params.locationId },
      select: {
        id: true,
        name: true,
        address: true,
        latitude: true,
        longitude: true,
        featured: true,
        hidden: true,
        createdAt: true,
        updatedAt: true,
        uploads: {
          orderBy: { createdAt: "desc" },
          take: 100,
          select: {
            id: true,
            tripId: true,
            eventId: true,
            guestSessionId: true,
            caption: true,
            fileUrl: true,
            fileType: true,
            status: true,
            locationVisibility: true,
            latitude: true,
            longitude: true,
            approximateLatitude: true,
            approximateLongitude: true,
            locationName: true,
            region: true,
            createdAt: true,
            approvedAt: true,
            rejectedAt: true,
            moderationStatus: true
          }
        }
      }
    });
    if (!location) return res.status(404).json({ error: "Location not found." });
    res.json({ location });
  } catch (error) {
    next(error);
  }
});

router.patch("/map/locations/:locationId", async (req, res, next) => {
  try {
    const schema = z.object({
      name: z.string().min(1).max(200).optional(),
      address: z.string().optional().nullable(),
      latitude: z.number().optional().nullable(),
      longitude: z.number().optional().nullable(),
      featured: z.boolean().optional(),
      hidden: z.boolean().optional()
    });
    const data = schema.parse(req.body);
    if ((data.latitude !== undefined && data.latitude !== null && (data.latitude < -90 || data.latitude > 90)) ||
        (data.longitude !== undefined && data.longitude !== null && (data.longitude < -180 || data.longitude > 180))) {
      return res.status(400).json({ error: "Invalid coordinates." });
    }
    const location = await prisma.location.update({
      where: { id: req.params.locationId },
      data: {
        name: data.name,
        address: data.address === undefined ? undefined : data.address,
        latitude: data.latitude === undefined ? undefined : data.latitude,
        longitude: data.longitude === undefined ? undefined : data.longitude,
        featured: data.featured === undefined ? undefined : data.featured,
        hidden: data.hidden === undefined ? undefined : data.hidden
      },
      select: {
        id: true,
        name: true,
        address: true,
        latitude: true,
        longitude: true,
        featured: true,
        hidden: true,
        createdAt: true,
        updatedAt: true
      }
    });
    res.json({ location });
  } catch (error) {
    next(error);
  }
});

router.delete("/map/locations/:locationId", async (req, res, next) => {
  try {
    const location = await prisma.location.update({
      where: { id: req.params.locationId },
      data: { hidden: true },
      select: { id: true }
    });
    if (!location) return res.status(404).json({ error: "Location not found." });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.patch("/map/uploads/:uploadId/moderation", async (req, res, next) => {
  try {
    const schema = z.object({
      action: z.enum(["hide", "unhide", "approve", "reject", "feature", "unfeature"]),
      locationVisibility: z.enum(["exact", "approximate", "city", "hidden"]).optional()
    });
    const data = schema.parse(req.body);
    let uploadUpdate = {};
    if (data.action === "approve") {
      uploadUpdate.status = "approved";
      uploadUpdate.approvedAt = new Date();
      uploadUpdate.rejectedAt = null;
    }
    if (data.action === "reject") {
      uploadUpdate.status = "rejected";
      uploadUpdate.rejectedAt = new Date();
      uploadUpdate.approvedAt = null;
    }
    if (data.action === "hide") {
      uploadUpdate.locationVisibility = "hidden";
    }
    if (data.action === "unhide") {
      uploadUpdate.locationVisibility = data.locationVisibility || "approximate";
    }
    let upload = null;
    if (data.action === "feature" || data.action === "unfeature") {
      upload = await prisma.upload.findUnique({
        where: { id: req.params.uploadId },
        select: {
          id: true,
          locationId: true,
          tripId: true,
          eventId: true,
          zoneId: true,
          guestSessionId: true,
          caption: true,
          fileUrl: true,
          fileType: true,
          status: true,
          latitude: true,
          longitude: true,
          approximateLatitude: true,
          approximateLongitude: true,
          locationName: true,
          region: true,
          locationVisibility: true,
          moderationStatus: true,
          createdAt: true,
          approvedAt: true,
          rejectedAt: true
        }
      });
      if (!upload) return res.status(404).json({ error: "Upload not found." });
      if (!upload.locationId) return res.status(400).json({ error: "Upload has no location to feature." });
      await prisma.location.update({ where: { id: upload.locationId }, data: { featured: data.action === "feature" } });
    } else {
      upload = await prisma.upload.update({
        where: { id: req.params.uploadId },
        data: uploadUpdate,
        select: {
          id: true,
          tripId: true,
          eventId: true,
          zoneId: true,
          guestSessionId: true,
          caption: true,
          fileUrl: true,
          fileType: true,
          status: true,
          latitude: true,
          longitude: true,
          approximateLatitude: true,
          approximateLongitude: true,
          locationName: true,
          region: true,
          locationVisibility: true,
          moderationStatus: true,
          createdAt: true,
          approvedAt: true,
          rejectedAt: true,
          locationId: true
        }
      });
    }
    await prisma.adminModerationLog.create({
      data: {
        uploadId: upload.id,
        adminId: req.user.id,
        action: data.action,
        notes: data.locationVisibility ? `Visibility restored as ${data.locationVisibility}.` : null
      }
    });
    res.json({ upload });
  } catch (error) {
    next(error);
  }
});

router.post("/export/site", async (req, res, next) => {
  try {
    // Select upload fields explicitly to avoid referencing optional columns
    // that may not yet exist in older databases (eg. skinId).
    const uploadSelect = {
      id: true,
      tripId: true,
      eventId: true,
      zoneId: true,
      guestSessionId: true,
      caption: true,
      fileUrl: true,
      fileType: true,
      status: true,
      latitude: true,
      longitude: true,
      approximateLatitude: true,
      approximateLongitude: true,
      locationName: true,
      region: true,
      locationVisibility: true,
      moderationStatus: true,
      createdAt: true,
      approvedAt: true,
      rejectedAt: true,
      downloadPurchaseItemId: true
    };

    const [users, trips, events, uploads, settings, ads, storeItems, purchases, guests] = await Promise.all([
      prisma.user.findMany({ include: { activeStoreItem: true } }),
      prisma.trip.findMany({ include: { chapters: true, shareLinks: true } }),
      prisma.event.findMany({ include: { maps: true, zones: true } }),
      prisma.upload.findMany({ select: uploadSelect }),
      prisma.platformSetting.findMany(),
      prisma.internalAd.findMany(),
      prisma.purchaseItem.findMany(),
      prisma.userPurchase.findMany(),
      prisma.guestSession.findMany()
    ]);
    res.json({
      exportedAt: new Date().toISOString(),
      formatVersion: 1,
      users: users.map(cleanUser),
      trips: trips.map(cleanTrip),
      events: events.map(cleanEvent),
      uploads: uploads.map(cleanUpload),
      settings,
      ads,
      storeItems,
      purchases,
      guests: guests.map(cleanGuestSession)
    });
  } catch (error) {
    next(error);
  }
});

router.get("/audit/moderation", async (req, res, next) => {
  try {
    const logs = await prisma.adminModerationLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        admin: { select: { id: true, name: true, email: true, role: true } },
        upload: { select: { id: true, caption: true, fileUrl: true, status: true } }
      }
    });
    res.json({ logs });
  } catch (error) {
    next(error);
  }
});

router.post("/import", async (req, res, next) => {
  try {
    const dryRun = req.query.dryRun !== "false";
    if (!dryRun && req.user.role !== "platform_admin") {
      return res.status(403).json({ error: "Platform admin access is required to run actual imports." });
    }
    const preview = getImportPreview(req.body || {});
    if (dryRun) {
      return res.json({
        dryRun: true,
        valid: true,
        counts: preview.counts,
        warnings: preview.warnings,
        message: "Dry-run validation complete. Full admin restore should use database backup/restore for now."
      });
    }

    const result = await executeAdminImport(req.body || {}, req.user?.id);
    res.json({
      dryRun: false,
      valid: true,
      ...result,
      message: "Import completed. Note: full database restore is still recommended for complete platform recovery."
    });
  } catch (error) {
    next(error);
  }
});

router.get("/users", async (req, res) => {
  const q = z.string().trim().max(100).catch("").parse(req.query.q?.toString() || "");
  const users = await prisma.user.findMany({
    where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } : {},
    select: { id: true, name: true, email: true, role: true, accountStatus: true, mustResetPassword: true, createdAt: true, _count: { select: { trips: true, organizedEvents: true, purchases: true } } },
    orderBy: { createdAt: "desc" },
    take: 100
  });
  res.json({ users });
});

router.get("/users/:userId", async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        accountStatus: true,
        mustResetPassword: true,
        emailVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
        preferences: {
          select: {
            defaultLocationVisibility: true,
            emailNotifications: true,
            uploadAlerts: true,
            promotionalEmails: true
          }
        },
        _count: {
          select: {
            trips: true,
            organizedEvents: true,
            claimedGuestSessions: true,
            purchases: true,
            notifications: true
          }
        }
      }
    });
    if (!user) return res.status(404).json({ error: "User not found." });
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

router.patch("/users/:userId", async (req, res, next) => {
  try {
    const schema = z.object({
      role: z.enum(["tourist", "admin", "platform_admin", "organizer", "guest"]).optional(),
      name: z.string().min(2).max(80).optional()
    });
    const data = schema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { id: req.params.userId }, select: { id: true, role: true, name: true } });
    if (!existing) return res.status(404).json({ error: "User not found." });

    const roleIsChanging = data.role && data.role !== existing.role;
    if (roleIsChanging && req.user.role !== "platform_admin") {
      return res.status(403).json({ error: "Platform admin access is required to change roles." });
    }
    if (roleIsChanging && existing.id === req.user.id) {
      return res.status(400).json({ error: "You cannot change your own admin role." });
    }
    if (roleIsChanging && existing.role === "platform_admin" && data.role !== "platform_admin") {
      const otherAdmins = await prisma.user.count({ where: { role: "platform_admin", id: { not: existing.id } } });
      if (otherAdmins === 0) {
        return res.status(400).json({ error: "Cannot demote the last platform_admin." });
      }
    }

    const user = await prisma.user.update({ where: { id: req.params.userId }, data, select: { id: true, name: true, email: true, role: true, createdAt: true } });

    // If role changed, notify the affected user
    if (roleIsChanging) {
      try {
        await createNotification(user.id, "Account role changed", `Your account role was changed to ${user.role}.`, "info", null);
      } catch (err) {
        console.error('notify role change failed', err?.message || err);
      }
    }

    res.json({ user });
  } catch (error) {
    next(error);
  }
});

router.get("/events", async (_req, res) => {
  const events = await prisma.event.findMany({
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      location: true,
      startDate: true,
      endDate: true,
      visibility: true,
      status: true,
      coverImageUrl: true,
      createdAt: true,
      updatedAt: true,
      organizer: { select: { id: true, name: true, email: true } },
      _count: { select: { uploads: true, zones: true } }
    },
    orderBy: { startDate: "desc" },
    take: 100
  });
  res.json({ events });
});

router.get("/guests", async (_req, res) => {
  const guests = await prisma.guestSession.findMany({
    select: {
      id: true,
      displayName: true,
      scopeType: true,
      scopeId: true,
      expiresAt: true,
      claimedById: true,
      createdAt: true,
      updatedAt: true,
      lastGuestAccessAt: true,
      accessRevokedAt: true,
      pinResetRequired: true,
      deletedAt: true,
      claimedBy: { select: { id: true, name: true, email: true } },
      _count: { select: { uploads: true, trips: true, events: true, qrUploadSpaces: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });
  res.json({ guests });
});

router.get("/audit/security", async (_req, res, next) => {
  try {
    const logs = await prisma.adminSecurityAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
    return res.json({ logs });
  } catch (error) {
    return next(error);
  }
});

router.post("/users/:userId/support", async (req, res, next) => {
  try {
    const data = supportReasonSchema.extend({
      action: z.enum(["send_password_reset", "expire_password_resets", "force_password_reset", "suspend", "reactivate", "close", "anonymize"])
    }).parse(req.body || {});
    const user = await prisma.user.findUnique({
      where: { id: req.params.userId },
      select: { id: true, name: true, email: true, role: true, accountStatus: true, mustResetPassword: true }
    });
    if (!user) return res.status(404).json({ error: "User not found." });
    if (["suspend", "close", "anonymize"].includes(data.action) && user.id === req.user.id) {
      return res.status(400).json({ error: "You cannot disable your own account." });
    }
    if (data.action === "anonymize" && (req.user.role !== "platform_admin" || data.confirmation !== true)) {
      return res.status(400).json({ error: "Platform admin access and explicit confirmation are required." });
    }
    if (["close", "anonymize"].includes(data.action) && user.role === "platform_admin") {
      const others = await prisma.user.count({ where: { role: "platform_admin", id: { not: user.id }, accountStatus: "active" } });
      if (others === 0) return res.status(400).json({ error: "Cannot disable the last active platform admin." });
    }

    let resetUrl;
    let emailSent = false;
    let deliveryError = null;
    let oldLinksRevoked = false;
    let afterStatus = user.accountStatus;
    if (data.action === "send_password_reset") {
      const token = secureToken(32);
      resetUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password/${token}`;
      await prisma.$transaction([
        prisma.passwordResetToken.updateMany({
          where: { userId: user.id, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() }
        }),
        prisma.passwordResetToken.create({
          data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 30 * 60 * 1000) }
        })
      ]);
      oldLinksRevoked = true;
      const delivery = await sendPasswordResetEmail({ user, resetUrl });
      emailSent = delivery.sent === true;
      if (!emailSent) deliveryError = delivery.error || "unknown error";
    } else if (data.action === "expire_password_resets") {
      await prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() }
      });
      oldLinksRevoked = true;
    } else if (data.action === "force_password_reset") {
      await prisma.user.update({ where: { id: user.id }, data: { mustResetPassword: true } });
    } else if (data.action === "suspend") {
      afterStatus = "suspended";
      await prisma.user.update({ where: { id: user.id }, data: { accountStatus: afterStatus, statusReason: data.reason, statusChangedAt: new Date() } });
    } else if (data.action === "reactivate") {
      afterStatus = "active";
      await prisma.user.update({ where: { id: user.id }, data: { accountStatus: afterStatus, statusReason: data.reason, statusChangedAt: new Date() } });
    } else if (data.action === "close") {
      afterStatus = "closed";
      await prisma.user.update({ where: { id: user.id }, data: { accountStatus: afterStatus, statusReason: data.reason, statusChangedAt: new Date() } });
    } else if (data.action === "anonymize") {
      afterStatus = "anonymized";
      const randomPasswordHash = await bcrypt.hash(secureToken(32), 12);
      await prisma.$transaction([
        prisma.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } }),
        prisma.user.update({
          where: { id: user.id },
          data: {
            name: "Deleted user",
            email: `deleted+${user.id}@example.invalid`,
            pendingEmail: null,
            emailChangeTokenHash: null,
            emailChangeTokenExpiresAt: null,
            passwordHash: randomPasswordHash,
            accountStatus: "anonymized",
            mustResetPassword: false,
            statusReason: data.reason,
            statusChangedAt: new Date(),
            anonymizedAt: new Date(),
            activeStoreItemId: null
          }
        })
      ]);
      oldLinksRevoked = true;
    }

    await writeSecurityAudit(req, {
      targetType: "user", targetId: user.id, action: data.action, reason: data.reason,
      beforeStatus: user.accountStatus, afterStatus,
      resetLinkGenerated: data.action === "send_password_reset",
      resetLinkSentTo: emailSent ? user.email : null,
      oldLinksRevoked,
      metadata: { mustResetPasswordBefore: user.mustResetPassword, emailSent, deliveryError }
    });
    if (deliveryError) {
      return res.status(502).json({ error: `Password reset link created, but email delivery failed: ${deliveryError}` });
    }
    return res.json({
      ok: true,
      action: data.action,
      accountStatus: afterStatus,
      mustResetPassword: data.action === "force_password_reset" ? true : user.mustResetPassword,
      ...(allowDevelopmentRecoveryUrl(resetUrl) ? { devResetUrl: resetUrl } : {})
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/guests/:guestId/support", async (req, res, next) => {
  try {
    const data = supportReasonSchema.extend({
      action: z.enum(["generate_pin_reset", "revoke_links", "force_pin_reset", "revoke_access", "delete_session"])
    }).parse(req.body || {});
    if (data.action === "delete_session" && data.confirmation !== true) {
      return res.status(400).json({ error: "Explicit confirmation is required." });
    }
    const guest = await prisma.guestSession.findUnique({
      where: { id: req.params.guestId },
      select: { id: true, displayName: true, claimedById: true, accessRevokedAt: true, pinResetRequired: true, deletedAt: true }
    });
    if (!guest) return res.status(404).json({ error: "Guest session not found." });
    if (guest.claimedById || guest.deletedAt) return res.status(400).json({ error: "Guest session is not eligible for support recovery." });

    let recoveryUrl;
    let oldLinksRevoked = false;
    let afterStatus = guest.deletedAt ? "deleted" : guest.accessRevokedAt ? "revoked" : guest.pinResetRequired ? "pin_reset_required" : "active";
    if (data.action === "generate_pin_reset") {
      const token = secureToken(32);
      recoveryUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/guest/reset-pin/${token}`;
      await prisma.$transaction([
        prisma.guestPinResetToken.updateMany({ where: { guestSessionId: guest.id, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } }),
        prisma.guestPinResetToken.create({ data: { guestSessionId: guest.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 30 * 60 * 1000) } }),
        prisma.guestSession.update({ where: { id: guest.id }, data: { resumeCode: null, resumeTokenHash: null, pinResetRequired: true } })
      ]);
      oldLinksRevoked = true;
      afterStatus = "pin_reset_required";
    } else if (data.action === "revoke_links") {
      await prisma.$transaction([
        prisma.guestPinResetToken.updateMany({ where: { guestSessionId: guest.id, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } }),
        prisma.guestSession.update({ where: { id: guest.id }, data: { resumeCode: null, resumeTokenHash: null } })
      ]);
      oldLinksRevoked = true;
    } else if (data.action === "force_pin_reset") {
      await prisma.guestSession.update({ where: { id: guest.id }, data: { pinResetRequired: true } });
      afterStatus = "pin_reset_required";
    } else if (data.action === "revoke_access") {
      await prisma.guestSession.update({ where: { id: guest.id }, data: { accessRevokedAt: new Date() } });
      afterStatus = "revoked";
    } else if (data.action === "delete_session") {
      await prisma.$transaction([
        prisma.guestPinResetToken.updateMany({ where: { guestSessionId: guest.id, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } }),
        prisma.guestSession.update({
          where: { id: guest.id },
          data: {
            token: secureToken(32), displayName: "Deleted guest", deviceFingerprint: null,
            resumeCode: null, resumeTokenHash: null, passcodeHash: null,
            accessRevokedAt: new Date(), deletedAt: new Date(), pinResetRequired: true
          }
        })
      ]);
      oldLinksRevoked = true;
      afterStatus = "deleted";
    }

    await writeSecurityAudit(req, {
      targetType: "guest", targetId: guest.id, action: data.action, reason: data.reason,
      beforeStatus: guest.deletedAt ? "deleted" : guest.accessRevokedAt ? "revoked" : guest.pinResetRequired ? "pin_reset_required" : "active",
      afterStatus, resetLinkGenerated: data.action === "generate_pin_reset", oldLinksRevoked
    });
    return res.json({ ok: true, action: data.action, status: afterStatus, ...(recoveryUrl ? { recoveryUrl } : {}) });
  } catch (error) {
    return next(error);
  }
});

router.get("/analytics", async (req, res, next) => {
  const query = analyticsQuerySchema.safeParse(req.query);
  if (!query.success) {
    return res.status(400).json({ error: query.error.errors[0]?.message || "Invalid analytics range." });
  }

  try {
    const [analytics, reporting] = await Promise.all([
      getAdminAnalytics({ days: query.data.days }),
      getAdminReportingDepth({ days: query.data.days })
    ]);
    analytics.reporting = reporting;
    return res.json({ analytics });
  } catch (error) {
    return next(error);
  }
});

router.get("/payments/status", (_req, res) => {
  res.json({ payments: getPaymentReadiness() });
});

router.get("/settings", async (_req, res) => {
  const guestAccessDays = Number(await settingValue("guestAccessDays", process.env.GUEST_ACCESS_DAYS || 3));
  const guestDeletionDays = Number(await settingValue("guestDeletionDays", process.env.GUEST_DELETION_DAYS || 14));
  const maxUploadSizeMb = Number(await settingValue("maxUploadSizeMb", process.env.MAX_UPLOAD_SIZE_MB || 50));
  const defaultPrivacy = await settingValue("defaultPrivacy", process.env.DEFAULT_LOCATION_VISIBILITY || "approximate");
  const moderationProvider = await settingValue("moderationProvider", process.env.MODERATION_PROVIDER || "disabled");
  const mapProvider = await settingValue("mapProvider", "mapbox");
  const paymentProvider = await settingValue("paymentProvider", process.env.PAYMENT_PROVIDER || "planned_stripe");
  const backgroundVideoUrl = await settingValue("backgroundVideoUrl", process.env.BACKGROUND_VIDEO_URL || "/videos/come-to-barbados.mp4");
  const backgroundMediaUrl = await settingValue("backgroundMediaUrl", backgroundVideoUrl);
  const backgroundMediaType = await settingValue("backgroundMediaType", inferBackgroundMediaType(backgroundMediaUrl, "video"));

  res.json({
    settings: {
      guestAccessDays,
      guestDeletionDays,
      maxUploadSizeMb,
      defaultPrivacy,
      moderationProvider,
      mapProvider,
      paymentProvider,
      backgroundVideoUrl,
      backgroundMediaUrl,
      backgroundMediaType
    }
  });
});

router.patch("/settings", async (req, res, next) => {
  try {
    // Allow updating a controlled set of platform settings via admin API.
    const allowedKeys = [
      "guestAccessDays",
      "guestDeletionDays",
      "maxUploadSizeMb",
      "defaultPrivacy",
      "moderationProvider",
      "mapProvider",
      "paymentProvider",
      "backgroundVideoUrl",
      "backgroundMediaUrl",
      "backgroundMediaType"
    ];

    // Accept a simple key/value object in the request body. Validate basic types.
    const schema = z.record(z.string(), z.any()).optional();
    const data = schema.parse(req.body) || {};

    for (const [key, value] of Object.entries(data)) {
      if (!allowedKeys.includes(key)) continue; // ignore unknown keys
      const stringValue = value === null || value === undefined ? "" : String(value);
      await prisma.platformSetting.upsert({
        where: { key },
        update: { value: stringValue },
        create: { key, value: stringValue }
      });
    }

    // Return the current settings after updates (read via DB/env fallback)
    const guestAccessDays = Number(await settingValue("guestAccessDays", process.env.GUEST_ACCESS_DAYS || 3));
    const guestDeletionDays = Number(await settingValue("guestDeletionDays", process.env.GUEST_DELETION_DAYS || 14));
    const maxUploadSizeMb = Number(await settingValue("maxUploadSizeMb", process.env.MAX_UPLOAD_SIZE_MB || 50));
    const defaultPrivacy = await settingValue("defaultPrivacy", process.env.DEFAULT_LOCATION_VISIBILITY || "approximate");
    const moderationProvider = await settingValue("moderationProvider", process.env.MODERATION_PROVIDER || "disabled");
    const mapProvider = await settingValue("mapProvider", "mapbox");
    const paymentProvider = await settingValue("paymentProvider", process.env.PAYMENT_PROVIDER || "planned_stripe");
    const backgroundVideoUrl = await settingValue("backgroundVideoUrl", process.env.BACKGROUND_VIDEO_URL || "/videos/come-to-barbados.mp4");
    const backgroundMediaUrl = await settingValue("backgroundMediaUrl", backgroundVideoUrl);
    const backgroundMediaType = await settingValue("backgroundMediaType", inferBackgroundMediaType(backgroundMediaUrl, "video"));

    res.json({
      settings: {
        guestAccessDays,
        guestDeletionDays,
        maxUploadSizeMb,
        defaultPrivacy,
        moderationProvider,
        mapProvider,
        paymentProvider,
        backgroundVideoUrl,
        backgroundMediaUrl,
        backgroundMediaType
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post("/users/:userId/safe-delete", async (req, res, next) => {
  try {
    return res.status(410).json({ error: "Use the audited account support anonymize action." });
  } catch (error) {
    next(error);
  }
});

router.get("/moderation", async (req, res) => {
  try {
    const query = z.object({
      status: z.enum(["all", "pending", "approved", "rejected", "reported"]).default("reported"),
      limit: z.coerce.number().int().min(1).max(100).default(50)
    }).parse(req.query);
    const uploads = await prisma.upload.findMany({
      where: query.status === "all" ? {} : { status: query.status },
      select: {
        id: true,
        tripId: true,
        eventId: true,
        guestSessionId: true,
        caption: true,
        fileUrl: true,
        fileType: true,
        status: true,
        aiFlagged: true,
        reportReason: true,
        locationName: true,
        locationVisibility: true,
        moderationStatus: true,
        createdAt: true,
        approvedAt: true,
        rejectedAt: true,
        trip: { select: { title: true, destination: true, user: { select: { id: true, name: true, email: true } } } },
        event: { select: { title: true, organizer: { select: { id: true, name: true, email: true } } } }
      },
      orderBy: { createdAt: "desc" },
      take: query.limit
    });
    res.json({ uploads, filter: { status: query.status, limit: query.limit } });
  } catch (error) {
    // If the database is missing optional columns (eg. skinId) this query
    // may fail with a Prisma P2022 error. Surface a helpful message rather
    // than allowing the process to crash.
    if (error.name === "ZodError") return next(error);
    console.error("Moderation listing failed", error);
    res.status(500).json({ error: "Moderation listing failed. Database schema may be out of date." });
  }
});

router.delete("/moderation/:uploadId", async (req, res, next) => {
  try {
    const upload = await prisma.upload.findUnique({ where: { id: req.params.uploadId }, select: { id: true } });
    if (!upload) return res.status(404).json({ error: "Upload not found." });
    await prisma.upload.delete({ where: { id: upload.id } });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get("/notifications", async (req, res, next) => {
  try {
    const query = z.object({ limit: z.coerce.number().int().min(1).max(100).default(50) }).parse(req.query);
    const notifications = await prisma.notification.findMany({
      select: {
        id: true,
        title: true,
        message: true,
        type: true,
        targetUrl: true,
        readAt: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } }
      },
      orderBy: { createdAt: "desc" },
      take: query.limit
    });
    res.json({ notifications });
  } catch (error) {
    next(error);
  }
});

router.post("/notifications", async (req, res, next) => {
  try {
    const data = z.object({
      userId: z.string().min(1),
      title: z.string().trim().min(2).max(120),
      message: z.string().trim().min(2).max(500),
      type: z.enum(["info", "success", "warning", "error"]).default("info"),
      targetUrl: z.string().max(500).optional().nullable()
    }).parse(req.body);
    if (data.targetUrl && !/^\/(?!\/)[^\\\s]*$/.test(data.targetUrl)) {
      return res.status(400).json({ error: "Notification target must be an internal path." });
    }
    const recipient = await prisma.user.findUnique({ where: { id: data.userId }, select: { id: true } });
    if (!recipient) return res.status(404).json({ error: "User not found." });
    const notification = await prisma.notification.create({
      data: {
        userId: recipient.id,
        title: data.title,
        message: data.message,
        type: data.type,
        targetUrl: data.targetUrl || null
      },
      select: { id: true, title: true, message: true, type: true, targetUrl: true, readAt: true, createdAt: true }
    });
    res.status(201).json({ notification });
  } catch (error) {
    next(error);
  }
});
 

router.patch("/uploads/:uploadId/download-item", async (req, res, next) => {
  try {
    const data = z.object({ itemId: z.string().optional().nullable() }).parse(req.body);
    const upload = await prisma.upload.update({
      where: { id: req.params.uploadId },
      data: { downloadPurchaseItemId: data.itemId },
      select: {
        id: true,
        tripId: true,
        eventId: true,
        zoneId: true,
        guestSessionId: true,
        caption: true,
        fileUrl: true,
        fileType: true,
        status: true,
        latitude: true,
        longitude: true,
        approximateLatitude: true,
        approximateLongitude: true,
        locationName: true,
        region: true,
        locationVisibility: true,
        moderationStatus: true,
        createdAt: true,
        approvedAt: true,
        rejectedAt: true
      }
    });
    res.json({ upload });
  } catch (error) {
    next(error);
  }
});

router.post("/moderation/:uploadId/log", async (req, res, next) => {
  try {
    const schema = z.object({
      action: z.string().min(2).max(80),
      notes: z.string().max(500).optional()
    });
    const data = schema.parse(req.body);
    const log = await prisma.adminModerationLog.create({
      data: {
        uploadId: req.params.uploadId,
        adminId: req.user.id,
        action: data.action,
        notes: data.notes
      }
    });
    res.status(201).json({ log });
  } catch (error) {
    next(error);
  }
});

router.get("/ads/analytics", async (req, res, next) => {
  try {
    const { days } = analyticsQuerySchema.parse(req.query);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const [ads, counts] = await Promise.all([
      prisma.internalAd.findMany({
        orderBy: [{ active: "desc" }, { priority: "desc" }, { updatedAt: "desc" }],
        take: 100,
        select: { id: true, title: true }
      }),
      prisma.adInteraction.groupBy({
        by: ["adId", "type"],
        where: { createdAt: { gte: since } },
        _count: { _all: true }
      })
    ]);

    const countsByAd = new Map();
    for (const count of counts) {
      const current = countsByAd.get(count.adId) || { impressions: 0, clicks: 0 };
      if (count.type === "impression") current.impressions = count._count._all;
      if (count.type === "click") current.clicks = count._count._all;
      countsByAd.set(count.adId, current);
    }

    res.json({
      days,
      updatedAt: new Date().toISOString(),
      ads: ads.map((ad) => {
        const summary = countsByAd.get(ad.id) || { impressions: 0, clicks: 0 };
        return {
          adId: ad.id,
          impressions: summary.impressions,
          clicks: summary.clicks,
          ctr: summary.impressions > 0 ? Number(((summary.clicks / summary.impressions) * 100).toFixed(2)) : 0
        };
      })
    });
  } catch (error) {
    next(error);
  }
});

router.get("/ads", async (_req, res) => {
  const ads = await prisma.internalAd.findMany({
    orderBy: [{ active: "desc" }, { priority: "desc" }, { updatedAt: "desc" }],
    take: 100
  });
  res.json({ ads });
});

router.get("/store", async (_req, res) => {
  const items = await prisma.purchaseItem.findMany({
    include: { _count: { select: { purchases: true } } },
    orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
    take: 100
  });
  res.json({ items });
});

router.post("/store", async (req, res, next) => {
  try {
    const data = storeItemSchema.parse(req.body);
    const item = await prisma.purchaseItem.create({
      data: {
        ...data,
        description: data.description || null,
        previewUrl: data.previewUrl || null,
        priceCents: data.priceCents || 0,
        active: data.active ?? true,
        metadata: data.metadata || undefined
      }
    });
    res.status(201).json({ item });
  } catch (error) {
    next(error);
  }
});

router.patch("/store/:itemId", async (req, res, next) => {
  try {
    const data = storeItemSchema.partial().parse(req.body);
    const existing = await prisma.purchaseItem.findUnique({ where: { id: req.params.itemId } });
    if (!existing) return res.status(404).json({ error: "Store item not found." });

    const stripeSensitiveFields = ["name", "description", "type", "priceCents"];
    const shouldClearStripePrice = stripeSensitiveFields.some((field) => Object.prototype.hasOwnProperty.call(data, field));
    let metadata = data.metadata;
    if (shouldClearStripePrice && existing.metadata && !data.metadata && !Array.isArray(existing.metadata)) {
      const { stripePriceId, stripeLookupKey, stripeCurrency, ...rest } = existing.metadata;
      metadata = rest;
    }

    const item = await prisma.purchaseItem.update({
      where: { id: req.params.itemId },
      data: {
        ...data,
        ...(metadata !== undefined ? { metadata } : {})
      }
    });
    res.json({ item });
  } catch (error) {
    next(error);
  }
});

const allowedAdMediaMimeTypes = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "video/mp4", "video/webm", "video/quicktime"
]);
const allowedAdMediaExtensions = new Set(["jpg", "jpeg", "png", "webp", "gif", "mp4", "webm", "mov"]);
const adRotationSchema = z.object({
  rotationMinutes: z.coerce.number().int().min(1).max(1440)
});

function normalizeAdMediaType(value, mimeType = "") {
  const candidate = String(value || mimeType).toLowerCase();
  return candidate === "video" || candidate.startsWith("video/") ? "video" : "image";
}

router.get("/ads/config", async (_req, res, next) => {
  try {
    const rotationMinutes = Number(await settingValue("adRotationMinutes", 5));
    res.json({ rotationMinutes: Number.isInteger(rotationMinutes) && rotationMinutes >= 1 && rotationMinutes <= 1440 ? rotationMinutes : 5 });
  } catch (error) {
    next(error);
  }
});

router.patch("/ads/config", async (req, res, next) => {
  try {
    const { rotationMinutes } = adRotationSchema.parse(req.body);
    await prisma.platformSetting.upsert({
      where: { key: "adRotationMinutes" },
      update: { value: String(rotationMinutes) },
      create: { key: "adRotationMinutes", value: String(rotationMinutes) }
    });
    res.json({ rotationMinutes });
  } catch (error) {
    next(error);
  }
});

router.post("/ads/media", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "An image or video file is required." });
    const extension = req.file.originalname?.split(".").pop()?.toLowerCase() || "";
    if (!allowedAdMediaMimeTypes.has(req.file.mimetype) || !allowedAdMediaExtensions.has(extension)) {
      return res.status(400).json({ error: "Only JPG, PNG, WEBP, GIF, MP4, WEBM, and MOV ad media files are allowed." });
    }
    const media = await uploadMedia(req.file, { key: `travel-share/ads/${secureToken(18)}.${extension}` });
    const mediaUrl = media?.fileUrl;
    const mediaType = normalizeAdMediaType(media?.fileType, req.file.mimetype);
    if (!mediaUrl) throw Object.assign(new Error("Ad media storage did not return a public URL."), { status: 502, expose: true });
    const filename = req.file.originalname.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 180);
    res.status(201).json({
      url: mediaUrl,
      mediaUrl,
      mediaType,
      filename,
      mimeType: req.file.mimetype,
      media: { fileUrl: mediaUrl, fileType: mediaType }
    });
  } catch (error) {
    next(error);
  }
});

router.post("/ads", async (req, res, next) => {
  try {
    const data = adSchema.parse(req.body);
    const ad = await prisma.internalAd.create({
      data: {
        ...data,
        description: data.description || null,
        linkUrl: data.linkUrl || null,
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
        createdById: req.user.id
      }
    });
    res.status(201).json({ ad });
  } catch (error) {
    next(error);
  }
});

router.patch("/ads/:adId", async (req, res, next) => {
  try {
    const data = adSchema.partial().parse(req.body);
    const existing = await prisma.internalAd.findUnique({ where: { id: req.params.adId } });
    if (!existing) return res.status(404).json({ error: "Ad not found." });

    const ad = await prisma.internalAd.update({
      where: { id: existing.id },
      data: {
        ...data,
        description: data.description === undefined ? undefined : data.description || null,
        linkUrl: data.linkUrl === undefined ? undefined : data.linkUrl || null,
        startsAt: data.startsAt === undefined ? undefined : data.startsAt ? new Date(data.startsAt) : null,
        endsAt: data.endsAt === undefined ? undefined : data.endsAt ? new Date(data.endsAt) : null
      }
    });
    res.json({ ad });
  } catch (error) {
    next(error);
  }
});

router.delete("/ads/:adId", async (req, res) => {
  const existing = await prisma.internalAd.findUnique({ where: { id: req.params.adId } });
  if (!existing) return res.status(404).json({ error: "Ad not found." });
  await prisma.internalAd.delete({ where: { id: existing.id } });
  res.status(204).end();
});

// Background media upload for admin settings
const allowedBackgroundMediaMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/webm"
]);

const allowedBackgroundMediaExtensions = new Set(["jpg", "jpeg", "png", "webp", "mp4", "webm"]);

function inferBackgroundMediaType(value, fallback = "video") {
  if (!value || typeof value !== "string") return fallback;
  const normalizedValue = value.toLowerCase();
  const extension = normalizedValue.match(/\.([a-z0-9]{2,5})(?:[?#].*)?$/)?.[1];
  if (["mp4", "webm", "mov", "m4v"].includes(extension)) return "video";
  if (["jpg", "jpeg", "png", "webp", "gif", "avif"].includes(extension)) return "image";
  return fallback;
}

router.post("/settings/background-media", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "A file is required." });
    }

    const mimeType = req.file.mimetype || "";
    const extension = (req.file.originalname || "").split(".").pop()?.toLowerCase() || "";

    if (!allowedBackgroundMediaMimeTypes.has(mimeType) && !allowedBackgroundMediaExtensions.has(extension)) {
      return res.status(400).json({ error: "Only JPG, PNG, WEBP, MP4, and WEBM files are allowed." });
    }

    if (req.file.size > maxMb * 1024 * 1024) {
      return res.status(413).json({ error: "File is too large." });
    }

    const mediaType = mimeType.startsWith("video/") ? "video" : "image";
    const stored = await uploadMedia(req.file, { key: `background-media/${secureToken(12)}.${extension || (mediaType === "video" ? "mp4" : "jpg")}` });

    res.json({
      mediaUrl: stored?.fileUrl,
      mediaType: stored?.fileType || mediaType
    });
  } catch (error) {
    next(error);
  }
});

export default router;
