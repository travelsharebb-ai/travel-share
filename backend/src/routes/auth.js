import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma.js";
import { authLimiter } from "../middleware/rateLimits.js";
import { requireAuth } from "../middleware/auth.js";
import { hashToken, readCookie, secureToken } from "../utils/tokens.js";
import { getGuestLifecycle } from "../services/sessionService.js";
import crypto from "node:crypto";
import { sendPasswordResetEmail } from "../utils/email.js";
import { cleanUpload, cleanUser } from "../utils/exportImport.js";
import { ensureBasicSkinUnlocks } from "../utils/skins.js";

const router = Router();

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const signupSchema = credentialsSchema.extend({
  name: z.string().min(2).max(80),
  guestToken: z.string().optional().nullable()
});

const resetRequestSchema = z.object({
  email: z.string().email()
});

const resetPasswordSchema = z.object({
  token: z.string().min(24),
  password: z.string().min(8)
});

const profileSettingsSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  email: z.string().email().optional(),
  currentPassword: z.string().min(8).optional(),
  newPassword: z.string().min(8).optional(),
  preferences: z.object({
    defaultLocationVisibility: z.enum(["exact", "approximate", "hidden"]).optional(),
    emailNotifications: z.boolean().optional(),
    uploadAlerts: z.boolean().optional(),
    promotionalEmails: z.boolean().optional()
  }).optional()
});

function sign(user) {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

function defaultRoleForEmail(email) {
  return process.env.ADMIN_EMAIL === email ? "platform_admin" : "tourist";
}

function providerConfig(provider) {
  if (provider === "google") {
    return {
      name: "Google",
      authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      userInfoUrl: "https://openidconnect.googleapis.com/v1/userinfo",
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      redirectUri: process.env.GOOGLE_REDIRECT_URI || `${process.env.BACKEND_URL || process.env.API_URL || "http://localhost:10000"}/api/auth/oauth/google/callback`,
      scope: "openid email profile"
    };
  }

  if (provider === "microsoft") {
    return {
      name: "Microsoft",
      authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
      tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      userInfoUrl: "https://graph.microsoft.com/oidc/userinfo",
      clientId: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      redirectUri: process.env.MICROSOFT_REDIRECT_URI || `${process.env.BACKEND_URL || process.env.API_URL || "http://localhost:10000"}/api/auth/oauth/microsoft/callback`,
      scope: "openid email profile"
    };
  }

  return null;
}

function oauthConfigured(config) {
  return Boolean(config?.clientId && config?.clientSecret);
}

function frontendOAuthUrl(payload) {
  const url = new URL("/oauth/callback", process.env.FRONTEND_URL || "http://localhost:5173");
  url.searchParams.set("token", payload.token);
  url.searchParams.set("user", Buffer.from(JSON.stringify(payload.user)).toString("base64url"));
  return url.toString();
}

async function ensureUserPreferences(userId) {
  return prisma.userPreference.upsert({
    where: { userId },
    update: {},
    create: { userId }
  });
}

router.post("/signup", authLimiter, async (req, res, next) => {
  try {
    const data = signupSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email.toLowerCase(),
        passwordHash,
        role: defaultRoleForEmail(data.email.toLowerCase())
      },
      select: { id: true, name: true, email: true, role: true }
    });

    const guestToken = data.guestToken || readCookie(req, "ts_guest");
    if (guestToken) {
      const guest = await prisma.guestSession.findFirst({
        where: { token: guestToken, claimedById: null }
      });
      if (guest) {
        const lifecycle = await getGuestLifecycle(guest, { platformCache: req.platformCache });
        if (lifecycle.state !== "expired") {
          await prisma.$transaction([
            prisma.guestSession.update({ where: { id: guest.id }, data: { claimedById: user.id } }),
            prisma.trip.updateMany({ where: { guestSessionId: guest.id, userId: null }, data: { userId: user.id } }),
            prisma.event.updateMany({ where: { guestSessionId: guest.id, organizerId: null }, data: { organizerId: user.id } })
          ]);
        }
      }
    }
    await ensureBasicSkinUnlocks(user.id).catch((error) => {
      console.error("Failed to grant basic skins on signup", error);
    });

    res.status(201).json({ user, token: sign(user) });
  } catch (error) {
    if (error.code === "P2002") return res.status(409).json({ error: "Email already exists." });
    next(error);
  }
});

router.get("/oauth/:provider", authLimiter, (req, res) => {
  const provider = req.params.provider;
  const config = providerConfig(provider);
  if (!config) {
    return res.status(404).json({ error: "OAuth provider not supported." });
  }

  if (!oauthConfigured(config)) {
    return res.status(501).json({
      error: `${config.name} sign-in is ready in code, but provider credentials are missing. Add ${provider.toUpperCase()}_CLIENT_ID and ${provider.toUpperCase()}_CLIENT_SECRET.`
    });
  }

  const state = jwt.sign({ provider }, process.env.JWT_SECRET, { expiresIn: "10m" });
  const url = new URL(config.authUrl);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.scope);
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  res.redirect(url.toString());
});

router.get("/oauth/:provider/callback", authLimiter, async (req, res, next) => {
  try {
    const provider = req.params.provider;
    const config = providerConfig(provider);
    if (!config || !oauthConfigured(config)) return res.status(404).send("OAuth provider not configured.");

    const payload = jwt.verify(req.query.state, process.env.JWT_SECRET);
    if (payload.provider !== provider) return res.status(400).send("Invalid OAuth state.");
    if (!req.query.code) return res.status(400).send("Missing OAuth code.");

    const tokenResponse = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code: req.query.code.toString(),
        grant_type: "authorization_code",
        redirect_uri: config.redirectUri
      })
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) return res.status(400).send(tokenData.error_description || tokenData.error || "OAuth token exchange failed.");

    const profileResponse = await fetch(config.userInfoUrl, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const profile = await profileResponse.json();
    if (!profileResponse.ok || !profile.email) return res.status(400).send("Could not read OAuth profile email.");

    const email = profile.email.toLowerCase();
    const user = await prisma.user.upsert({
      where: { email },
      update: { name: profile.name || profile.given_name || email },
      create: {
        name: profile.name || profile.given_name || email.split("@")[0],
        email,
        passwordHash: await bcrypt.hash(secureToken(24), 12),
        role: defaultRoleForEmail(email)
      },
      select: { id: true, name: true, email: true, role: true }
    });
    await ensureBasicSkinUnlocks(user.id).catch((error) => {
      console.error("Failed to grant basic skins on OAuth sign-in", error);
    });

    res.redirect(frontendOAuthUrl({ user, token: sign(user) }));
  } catch (error) {
    next(error);
  }
});

router.post("/login", authLimiter, async (req, res, next) => {
  try {
    const data = credentialsSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
    if (!user) return res.status(401).json({ error: "Invalid email or password." });

    const valid = await bcrypt.compare(data.password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid email or password." });

    const safeUser = { id: user.id, name: user.name, email: user.email, role: user.role };
    await ensureBasicSkinUnlocks(user.id).catch((error) => {
      console.error("Failed to grant basic skins on login", error);
    });
    res.json({ user: safeUser, token: sign(user) });
  } catch (error) {
    next(error);
  }
});

router.post("/forgot-password", authLimiter, async (req, res, next) => {
  try {
    const data = resetRequestSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
      select: { id: true, name: true, email: true }
    });

    if (user) {
      const token = secureToken(32);
      const tokenHash = hashToken(token);
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt
        }
      });

      const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${token}`;
      await sendPasswordResetEmail({ user, resetUrl });
    }

    res.json({ message: "If that email exists, a password reset link has been sent." });
  } catch (error) {
    next(error);
  }
});

router.get("/reset-password/:token", authLimiter, async (req, res) => {
  const tokenHash = hashToken(req.params.token);
  const resetToken = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  res.json({
    valid: Boolean(resetToken && !resetToken.usedAt && resetToken.expiresAt > new Date())
  });
});

router.post("/reset-password", authLimiter, async (req, res, next) => {
  try {
    const data = resetPasswordSchema.parse(req.body);
    const tokenHash = hashToken(data.token);
    const resetToken = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date()) {
      return res.status(400).json({ error: "This reset link is invalid or expired." });
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash }
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() }
      }),
      prisma.passwordResetToken.updateMany({
        where: { userId: resetToken.userId, usedAt: null, id: { not: resetToken.id } },
        data: { usedAt: new Date() }
      })
    ]);

    res.json({ message: "Password updated. You can now log in." });
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    await ensureUserPreferences(req.user.id);
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        preferences: true,
        purchases: { include: { item: true }, orderBy: { createdAt: "desc" } },
        activeStoreItem: true
      }
    });
    await ensureBasicSkinUnlocks(req.user.id).catch((error) => {
      console.error("Failed to grant basic skins while loading profile", error);
    });
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

router.patch("/me", requireAuth, async (req, res, next) => {
  try {
    const data = profileSettingsSchema.parse(req.body);
    const update = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.email !== undefined) {
      const email = data.email.toLowerCase();
      const existing = await prisma.user.findFirst({ where: { email, id: { not: req.user.id } } });
      if (existing) return res.status(409).json({ error: "Email already exists." });
      update.email = email;
    }
    if (data.newPassword) {
      if (!data.currentPassword) return res.status(400).json({ error: "Current password is required to change password." });
      const current = await prisma.user.findUnique({ where: { id: req.user.id }, select: { passwordHash: true } });
      const valid = current ? await bcrypt.compare(data.currentPassword, current.passwordHash) : false;
      if (!valid) return res.status(403).json({ error: "Current password is incorrect." });
      update.passwordHash = await bcrypt.hash(data.newPassword, 12);
    }

    if (Object.keys(update).length) {
      await prisma.user.update({ where: { id: req.user.id }, data: update });
    }
    if (data.preferences) {
      await prisma.userPreference.upsert({
        where: { userId: req.user.id },
        update: data.preferences,
        create: { userId: req.user.id, ...data.preferences }
      });
    } else {
      await ensureUserPreferences(req.user.id);
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        preferences: true,
        purchases: { include: { item: true }, orderBy: { createdAt: "desc" } },
        activeStoreItem: true
      }
    });
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

router.get("/export", requireAuth, async (req, res, next) => {
  try {
    const format = req.query.format?.toString() || "json";
    if (format !== "json") return res.status(400).json({ error: "Only JSON export is available in this build." });
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        purchases: { include: { item: true } },
        activeStoreItem: true,
        trips: { include: { chapters: true, shareLinks: true, uploads: true } },
        organizedEvents: { include: { maps: true, zones: true, uploads: true } }
      }
    });
    res.setHeader("Content-Disposition", `attachment; filename="travelshare-user-${req.user.id}.json"`);
    res.json({
      exportedAt: new Date().toISOString(),
      formatVersion: 1,
      user: cleanUser(user),
      activeStoreItem: user.activeStoreItem,
      purchases: user.purchases,
      trips: user.trips.map((trip) => ({ ...trip, uploads: trip.uploads.map(cleanUpload) })),
      events: user.organizedEvents.map((event) => ({ ...event, uploads: event.uploads.map(cleanUpload) }))
    });
  } catch (error) {
    next(error);
  }
});

router.post("/import", requireAuth, async (req, res, next) => {
  try {
    const dryRun = req.query.dryRun === "true";
    const trips = Array.isArray(req.body?.trips) ? req.body.trips : [];
    const events = Array.isArray(req.body?.events) ? req.body.events : [];
    if (dryRun) {
      return res.json({ dryRun: true, wouldImport: { trips: trips.length, events: events.length } });
    }

    const mapping = { trips: {}, events: {} };
    for (const trip of trips) {
      const created = await prisma.trip.create({
        data: {
          userId: req.user.id,
          title: trip.title || "Imported Trip",
          destination: trip.destination || "Imported",
          startDate: trip.startDate ? new Date(trip.startDate) : null,
          endDate: trip.endDate ? new Date(trip.endDate) : null,
          qrToken: crypto.randomBytes(16).toString("hex"),
          qrMode: trip.qrMode || "approval_required",
          defaultLocationVisibility: trip.defaultLocationVisibility || "approximate"
        }
      });
      mapping.trips[trip.id] = created.id;
    }

    for (const event of events) {
      const created = await prisma.event.create({
        data: {
          organizerId: req.user.id,
          title: event.title || "Imported Event",
          description: event.description || null,
          category: event.category || null,
          location: event.location || null,
          startDate: event.startDate ? new Date(event.startDate) : new Date(),
          endDate: event.endDate ? new Date(event.endDate) : null,
          visibility: event.visibility || "private",
          status: "draft",
          qrToken: crypto.randomBytes(16).toString("hex")
        }
      });
      mapping.events[event.id] = created.id;
    }

    res.status(201).json({ imported: { trips: Object.keys(mapping.trips).length, events: Object.keys(mapping.events).length }, mapping });
  } catch (error) {
    next(error);
  }
});

export default router;
