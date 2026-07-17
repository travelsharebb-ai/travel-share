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
import { sendPasswordResetEmail, sendEmailChangeRequest } from "../utils/email.js";
import { cleanUpload, cleanUser } from "../utils/exportImport.js";
import { createNotification } from "../services/notifications.js";
import { ensureBasicSkinUnlocks } from "../utils/skins.js";
import { allowDevelopmentRecoveryUrl, isStrongPassword, PASSWORD_REQUIREMENTS, writeSecurityAudit } from "../services/accountSecurityService.js";
import { createResetRequest } from "../services/resetRequestService.js";
import {
  oauthTempStore,
  OAUTH_HANDOFF_TTL_MS,
  OAUTH_STATE_TTL_MS
} from "../services/oauthTempStore.js";

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
  password: z.string(),
  confirmPassword: z.string().optional()
}).refine((value) => !value.confirmPassword || value.password === value.confirmPassword, {
  message: "Passwords do not match.", path: ["confirmPassword"]
}).refine((value) => isStrongPassword(value.password), {
  message: PASSWORD_REQUIREMENTS, path: ["password"]
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string(),
  confirmPassword: z.string()
}).refine((value) => value.newPassword === value.confirmPassword, {
  message: "Passwords do not match.", path: ["confirmPassword"]
}).refine((value) => isStrongPassword(value.newPassword), {
  message: PASSWORD_REQUIREMENTS, path: ["newPassword"]
});

const profileSettingsSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  email: z.string().email().optional(),
  currentPassword: z.string().min(8).optional(),
  newPassword: z.string().min(8).optional(),
  preferences: z.object({
    defaultLocationVisibility: z.enum(["exact", "approximate", "city", "hidden"]).optional(),
    emailNotifications: z.boolean().optional(),
    uploadAlerts: z.boolean().optional(),
    promotionalEmails: z.boolean().optional()
  }).optional()
});

const oauthExchangeSchema = z.object({
  code: z.string().min(32).max(256)
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

function frontendOAuthUrl({ code, error, provider }) {
  const url = new URL("/oauth/callback", process.env.FRONTEND_URL || "http://localhost:5173");
  if (code) url.searchParams.set("code", code);
  if (error) url.searchParams.set("error", error);
  if (provider) url.searchParams.set("provider", provider);
  return url.toString();
}

function safeInternalRedirect(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return null;

  try {
    const frontend = new URL(process.env.FRONTEND_URL || "http://localhost:5173");
    const destination = new URL(value, frontend.origin);
    if (destination.origin !== frontend.origin) return null;
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return null;
  }
}

function oauthStateCookieName(provider) {
  return `ts_oauth_${provider}`;
}

function oauthStateCookieOptions(provider) {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: OAUTH_STATE_TTL_MS,
    path: `/api/auth/oauth/${provider}/callback`
  };
}

function clearOAuthStateCookie(res, provider) {
  const { maxAge: _maxAge, ...options } = oauthStateCookieOptions(provider);
  res.clearCookie(oauthStateCookieName(provider), options);
}

function sameSecret(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function oauthError(res, provider, message) {
  return res.redirect(frontendOAuthUrl({ error: message, provider }));
}

async function ensureUserPreferences(userId) {
  return prisma.userPreference.upsert({
    where: { userId },
    update: {},
    create: { userId }
  });
}

function safeUserWithPasswordCapability(user) {
  const { passwordHash, ...safeUser } = user;
  return { ...safeUser, hasLocalPassword: Boolean(passwordHash) };
}

async function issuePasswordResetLink(user) {
  const token = secureToken(32);
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null, revokedAt: null },
      data: { revokedAt: new Date() }
    }),
    prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } })
  ]);

  const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password/${token}`;
  const delivery = await sendPasswordResetEmail({ user, resetUrl });
  return { resetUrl, delivery };
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
      select: { id: true, name: true, email: true, role: true, passwordHash: true }
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

    res.status(201).json({ user: safeUserWithPasswordCapability(user), token: sign(user) });
  } catch (error) {
    if (error.code === "P2002") return res.status(409).json({ error: "Email already exists." });
    next(error);
  }
});

router.get("/oauth/:provider", authLimiter, async (req, res, next) => {
  try {
    const provider = req.params.provider;
    const config = providerConfig(provider);
    if (!config) {
      return res.status(404).json({ error: "OAuth provider not supported." });
    }

    if (!oauthConfigured(config)) {
      return oauthError(res, provider, `${config.name} sign-in is temporarily unavailable. Please use email and password instead.`);
    }

    const nonce = secureToken(24);
    const codeVerifier = secureToken(48);
    const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");
    const redirect = safeInternalRedirect(req.query.redirect);
    const expiresAt = Date.now() + OAUTH_STATE_TTL_MS;
    await oauthTempStore.setState(
      nonce,
      { provider, redirect, codeVerifier, expiresAt },
      OAUTH_STATE_TTL_MS
    );

    const state = jwt.sign(
      { provider, nonce, redirect, expiresAt },
      process.env.JWT_SECRET,
      { expiresIn: Math.floor(OAUTH_STATE_TTL_MS / 1000) }
    );
    const url = new URL(config.authUrl);
    url.searchParams.set("client_id", config.clientId);
    url.searchParams.set("redirect_uri", config.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", config.scope);
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("prompt", "select_account");
    res.cookie(oauthStateCookieName(provider), nonce, oauthStateCookieOptions(provider));
    res.redirect(url.toString());
  } catch (error) {
    next(error);
  }
});

router.get("/oauth/:provider/callback", authLimiter, async (req, res, next) => {
  try {
    const provider = req.params.provider;
    const config = providerConfig(provider);
    if (!config) return res.status(404).json({ error: "OAuth provider not supported." });
    if (!oauthConfigured(config)) {
      return oauthError(res, provider, `${config.name} sign-in is temporarily unavailable. Please use email and password instead.`);
    }

    const stateToken = typeof req.query.state === "string" ? req.query.state : null;
    const stateCookie = readCookie(req, oauthStateCookieName(provider));
    clearOAuthStateCookie(res, provider);
    if (!stateToken) return oauthError(res, provider, "OAuth sign-in could not be verified. Please try again.");

    let payload;
    try {
      payload = jwt.verify(stateToken, process.env.JWT_SECRET);
    } catch (error) {
      const message = error?.name === "TokenExpiredError"
        ? "OAuth sign-in expired. Please try again."
        : "OAuth sign-in could not be verified. Please try again.";
      return oauthError(res, provider, message);
    }

    if (payload.provider !== provider) {
      return oauthError(res, provider, "OAuth provider mismatch. Please try again.");
    }

    const nonce = typeof payload.nonce === "string" ? payload.nonce : null;
    if (!nonce || !sameSecret(nonce, stateCookie)) {
      return oauthError(res, provider, "OAuth sign-in could not be verified. Please try again.");
    }
    const stateRecord = await oauthTempStore.takeState(nonce);
    if (!stateRecord) return oauthError(res, provider, "OAuth sign-in could not be verified. Please try again.");

    if (stateRecord.provider !== provider) {
      return oauthError(res, provider, "OAuth provider mismatch. Please try again.");
    }

    if (stateRecord.expiresAt <= Date.now() || payload.expiresAt !== stateRecord.expiresAt) {
      return oauthError(res, provider, "OAuth sign-in expired. Please try again.");
    }

    const redirect = safeInternalRedirect(payload.redirect);
    if ((payload.redirect || stateRecord.redirect) && redirect !== stateRecord.redirect) {
      return oauthError(res, provider, "OAuth redirect could not be verified. Please try again.");
    }

    if (req.query.error) {
      return oauthError(res, provider, `${config.name} sign-in was cancelled or denied.`);
    }

    if (!req.query.code) return oauthError(res, provider, "OAuth sign-in did not return an authorization code. Please try again.");

    const tokenResponse = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code: req.query.code.toString(),
        code_verifier: stateRecord.codeVerifier,
        grant_type: "authorization_code",
        redirect_uri: config.redirectUri
      })
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) return oauthError(res, provider, `${config.name} sign-in could not be completed. Please try again.`);

    const profileResponse = await fetch(config.userInfoUrl, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const profile = await profileResponse.json();
    if (!profileResponse.ok || !profile.email) return oauthError(res, provider, `${config.name} account information could not be read. Please try again.`);

    const email = profile.email.toLowerCase();
    const user = await prisma.user.upsert({
      where: { email },
      update: { name: profile.name || profile.given_name || email },
      create: {
        name: profile.name || profile.given_name || email.split("@")[0],
        email,
        passwordHash: null,
        role: defaultRoleForEmail(email)
      },
      select: { id: true, name: true, email: true, role: true, passwordHash: true }
    });
    const safeUser = safeUserWithPasswordCapability(user);
    await ensureBasicSkinUnlocks(user.id).catch((error) => {
      console.error("Failed to grant basic skins on OAuth sign-in", error);
    });

    const handoffCode = secureToken(32);
    await oauthTempStore.setHandoff(
      handoffCode,
      {
        user: safeUser,
        token: sign(user),
        redirect,
        expiresAt: Date.now() + OAUTH_HANDOFF_TTL_MS
      },
      OAUTH_HANDOFF_TTL_MS
    );
    res.redirect(frontendOAuthUrl({ code: handoffCode, provider }));
  } catch (error) {
    next(error);
  }
});

router.post("/oauth/exchange", authLimiter, async (req, res, next) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    const data = oauthExchangeSchema.safeParse(req.body);
    if (!data.success) return res.status(400).json({ error: "Invalid OAuth handoff code." });

    const handoff = await oauthTempStore.takeHandoff(data.data.code);
    if (!handoff || handoff.expiresAt <= Date.now()) {
      return res.status(400).json({ error: "OAuth sign-in expired or was already used. Please try again." });
    }

    return res.json({ user: handoff.user, token: handoff.token, redirect: handoff.redirect });
  } catch (error) {
    next(error);
  }
});

router.post("/login", authLimiter, async (req, res, next) => {
  try {
    const data = credentialsSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
    if (!user) return res.status(401).json({ error: "Invalid email or password." });

    if (user.accountStatus !== "active") {
      return res.status(403).json({ error: "This account is not active.", code: "ACCOUNT_INACTIVE" });
    }

    const valid = Boolean(user.passwordHash) && await bcrypt.compare(data.password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid email or password." });

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      mustResetPassword: user.mustResetPassword,
      hasLocalPassword: true
    };
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
      await issuePasswordResetLink(user);
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
    valid: Boolean(resetToken && !resetToken.usedAt && !resetToken.revokedAt && resetToken.expiresAt > new Date())
  });
});

router.post("/reset-password", authLimiter, async (req, res, next) => {
  try {
    const data = resetPasswordSchema.parse(req.body);
    const tokenHash = hashToken(data.token);
    const resetToken = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

    if (!resetToken || resetToken.usedAt || resetToken.revokedAt || resetToken.expiresAt <= new Date()) {
      return res.status(400).json({ error: "This reset link is invalid or expired." });
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash, mustResetPassword: false, passwordChangedAt: new Date() }
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() }
      }),
      prisma.passwordResetToken.updateMany({
        where: { userId: resetToken.userId, usedAt: null, revokedAt: null, id: { not: resetToken.id } },
        data: { revokedAt: new Date() }
      })
    ]);

    res.json({ message: "Password updated. You can now log in." });
  } catch (error) {
    next(error);
  }
});

router.patch("/me/password", requireAuth, async (req, res, next) => {
  try {
    if (req.user.role === "guest") return res.status(403).json({ error: "Guest accounts use a PIN." });
    const data = changePasswordSchema.parse(req.body || {});
    const current = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { passwordHash: true }
    });
    if (!current?.passwordHash) {
      return res.status(409).json({
        error: "This account does not have a local password. Request a secure password setup link instead.",
        code: "LOCAL_PASSWORD_NOT_SET"
      });
    }
    const valid = await bcrypt.compare(data.currentPassword, current.passwordHash);
    if (!valid) return res.status(403).json({ error: "Current password is incorrect." });

    const passwordHash = await bcrypt.hash(data.newPassword, 12);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: req.user.id },
        data: { passwordHash, mustResetPassword: false, passwordChangedAt: new Date() }
      });
      await tx.passwordResetToken.updateMany({
        where: { userId: req.user.id, usedAt: null, revokedAt: null },
        data: { revokedAt: new Date() }
      });
      await writeSecurityAudit(req, {
        targetType: "user",
        targetId: req.user.id,
        action: "password_changed",
        reason: "Self-service password change",
        oldLinksRevoked: true
      }, tx);
    });
    return res.json({ message: "Password changed successfully." });
  } catch (error) {
    return next(error);
  }
});

router.post("/me/password-setup", requireAuth, authLimiter, async (req, res, next) => {
  try {
    if (req.user.role === "guest") return res.status(403).json({ error: "Guest accounts use a PIN." });
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, passwordHash: true }
    });
    if (!user) return res.status(404).json({ error: "Account not found." });
    if (user.passwordHash) {
      return res.status(409).json({
        error: "This account already has a local password. Change it using your current password.",
        code: "LOCAL_PASSWORD_ALREADY_SET"
      });
    }

    const { resetUrl, delivery } = await issuePasswordResetLink(user);
    await writeSecurityAudit(req, {
      targetType: "user",
      targetId: user.id,
      action: "password_setup_requested",
      reason: "Self-service password setup for OAuth account",
      resetLinkGenerated: true,
      resetLinkSentTo: delivery.sent ? user.email : null,
      oldLinksRevoked: true,
      metadata: { emailSent: delivery.sent === true, deliveryError: delivery.error || null }
    });

    if (!delivery.sent) {
      return res.status(502).json({ error: "The secure setup link was created, but the email could not be sent. Please try again." });
    }

    return res.status(201).json({
      message: "A secure password setup link was sent to your email.",
      ...(allowDevelopmentRecoveryUrl(resetUrl) ? { devResetUrl: resetUrl } : {})
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/me/password-reset-request", requireAuth, authLimiter, async (req, res, next) => {
  try {
    if (req.user.role === "guest") return res.status(403).json({ error: "Guest accounts use PIN reset requests." });
    const data = z.object({ message: z.string().trim().min(5).max(1000) }).parse(req.body || {});
    const request = await createResetRequest(req, {
      requesterType: "user",
      requestType: "password_reset",
      userId: req.user.id,
      message: data.message
    });
    return res.status(201).json({
      request: { id: request.id, status: request.status, createdAt: request.createdAt },
      message: "Your password reset request was sent to support for review."
    });
  } catch (error) {
    return next(error);
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
        pendingEmail: true,
        emailVerifiedAt: true,
        email: true,
        role: true,
        accountStatus: true,
        mustResetPassword: true,
        passwordHash: true,
        preferences: true,
        purchases: { include: { item: true }, orderBy: { createdAt: "desc" } },
        activeStoreItem: true
      }
    });
    await ensureBasicSkinUnlocks(req.user.id).catch((error) => {
      console.error("Failed to grant basic skins while loading profile", error);
    });
    res.json({ user: safeUserWithPasswordCapability(user) });
  } catch (error) {
    next(error);
  }
});

router.patch("/me", requireAuth, async (req, res, next) => {
  try {
    const data = profileSettingsSchema.parse(req.body);
    if (req.user.role === "guest") {
      return res.status(403).json({ error: "Guest accounts cannot update profile settings." });
    }
    const update = {};
    if (data.name !== undefined) update.name = data.name;
    let devVerificationUrl = null;
    if (data.email !== undefined) {
      const email = data.email.toLowerCase();
      if (email === req.user.email) {
        // no-op
      } else {
        const existing = await prisma.user.findFirst({ where: { email, id: { not: req.user.id } } });
        if (existing) return res.status(409).json({ error: "Email already exists." });

        // create pending email change
        const token = secureToken(32);
        const tokenHash = hashToken(token);
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await prisma.user.update({ where: { id: req.user.id }, data: { pendingEmail: email, emailChangeTokenHash: tokenHash, emailChangeTokenExpiresAt: expiresAt } });

        const frontendBase = process.env.FRONTEND_URL || process.env.BACKEND_URL || process.env.API_URL || "http://localhost:10000";
        const verificationUrl = `${frontendBase.replace(/\/$/, "")}/verify-email-change?token=${token}`;
        // send verification email
        await sendEmailChangeRequest({ user: { id: req.user.id, name: req.user.name }, toEmail: email, verificationUrl });

        // notify user in-app about the pending email change request
        createNotification(req.user.id, "Email change requested", `A request to change your email to ${email} was started. Check your email to confirm.`, "info", null).catch?.(() => {});
        // In development or when email provider is console, surface a dev URL for testing
        if (process.env.NODE_ENV !== "production" || !process.env.SENDGRID_API_KEY) {
          devVerificationUrl = verificationUrl;
        }
      }
    }
    if (data.newPassword) {
      if (!data.currentPassword) return res.status(400).json({ error: "Current password is required to change password." });
      const current = await prisma.user.findUnique({ where: { id: req.user.id }, select: { passwordHash: true } });
      if (!current?.passwordHash) {
        return res.status(409).json({
          error: "This account does not have a local password. Request a secure password setup link instead.",
          code: "LOCAL_PASSWORD_NOT_SET"
        });
      }
      const valid = await bcrypt.compare(data.currentPassword, current.passwordHash);
      if (!valid) return res.status(403).json({ error: "Current password is incorrect." });
      update.passwordHash = await bcrypt.hash(data.newPassword, 12);
    }

    if (Object.keys(update).length) {
      await prisma.user.update({ where: { id: req.user.id }, data: update });
      // notify user about profile changes
      try {
        await createNotification(req.user.id, "Profile updated", "Your profile settings were updated successfully.", "info", null);
      } catch (err) {
        console.error('profile notification failed', err?.message || err);
      }
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
        pendingEmail: true,
        emailVerifiedAt: true,
        email: true,
        role: true,
        accountStatus: true,
        mustResetPassword: true,
        passwordHash: true,
        preferences: true,
        purchases: { include: { item: true }, orderBy: { createdAt: "desc" } },
        activeStoreItem: true
      }
    });
    const payload = { user: safeUserWithPasswordCapability(user) };
    if (devVerificationUrl) payload.devVerificationUrl = devVerificationUrl;
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

router.get("/verify-email-change", authLimiter, async (req, res, next) => {
  try {
    const token = req.query.token?.toString();
    if (!token) return res.status(400).json({ error: "Missing token." });
    const tokenHash = hashToken(token);
    const user = await prisma.user.findFirst({ where: { emailChangeTokenHash: tokenHash } });
    if (!user) return res.status(400).json({ error: "Invalid or expired token." });
    if (!user.pendingEmail || !user.emailChangeTokenExpiresAt || user.emailChangeTokenExpiresAt <= new Date()) {
      return res.status(400).json({ error: "This link is invalid or expired." });
    }

    // Ensure pendingEmail is not used by another user
    const existing = await prisma.user.findFirst({ where: { email: user.pendingEmail, id: { not: user.id } } });
    if (existing) return res.status(409).json({ error: "That email is already in use." });

    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { email: user.pendingEmail, pendingEmail: null, emailChangeTokenHash: null, emailChangeTokenExpiresAt: null, emailVerifiedAt: new Date() } })
    ]);

    res.json({ message: "Email updated and verified." });
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
