import { prisma } from "../utils/prisma.js";

export const PASSWORD_REQUIREMENTS = "Use at least 10 characters with uppercase, lowercase, and a number.";

export function isStrongPassword(value) {
  return typeof value === "string"
    && value.length >= 10
    && /[a-z]/.test(value)
    && /[A-Z]/.test(value)
    && /\d/.test(value);
}

export function requestContext(req) {
  return {
    ipAddress: req.ip || null,
    userAgent: req.get?.("user-agent") || null
  };
}

export async function writeSecurityAudit(req, {
  targetType,
  targetId,
  action,
  reason,
  beforeStatus = null,
  afterStatus = null,
  resetLinkGenerated = false,
  resetLinkSentTo = null,
  oldLinksRevoked = false,
  metadata = null
}, client = prisma) {
  return client.adminSecurityAuditLog.create({
    data: {
      adminId: req.user.id,
      adminEmail: req.user.email || "unknown",
      targetType,
      targetId,
      action,
      reason,
      beforeStatus,
      afterStatus,
      resetLinkGenerated,
      resetLinkSentTo,
      oldLinksRevoked,
      metadata,
      ...requestContext(req)
    }
  });
}

export function allowDevelopmentRecoveryUrl(url) {
  return process.env.NODE_ENV !== "production" ? url : undefined;
}
