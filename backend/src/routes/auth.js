import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma.js";
import { authLimiter } from "../middleware/rateLimits.js";
import { requireAuth } from "../middleware/auth.js";
import { hashToken, secureToken } from "../utils/tokens.js";
import { sendPasswordResetEmail } from "../utils/email.js";

const router = Router();

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const signupSchema = credentialsSchema.extend({
  name: z.string().min(2).max(80)
});

const resetRequestSchema = z.object({
  email: z.string().email()
});

const resetPasswordSchema = z.object({
  token: z.string().min(24),
  password: z.string().min(8)
});

function sign(user) {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
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
        role: process.env.ADMIN_EMAIL === data.email.toLowerCase() ? "admin" : "tourist"
      },
      select: { id: true, name: true, email: true, role: true }
    });

    res.status(201).json({ user, token: sign(user) });
  } catch (error) {
    if (error.code === "P2002") return res.status(409).json({ error: "Email already exists." });
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

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
