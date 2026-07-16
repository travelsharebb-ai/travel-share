import { prisma } from "../utils/prisma.js";
import { notifyActiveAdmins } from "./notifications.js";
import { requestContext } from "./accountSecurityService.js";

export const resetRequestSafeInclude = {
  user: { select: { id: true, name: true, email: true, accountStatus: true } },
  guestSession: {
    select: {
      id: true,
      displayName: true,
      createdAt: true,
      lastGuestAccessAt: true,
      expiresAt: true,
      accessRevokedAt: true,
      pinResetRequired: true,
      deletedAt: true
    }
  },
  resolvedByAdmin: { select: { id: true, name: true, email: true } }
};

export async function createResetRequest(req, data) {
  const context = requestContext(req);
  const request = await prisma.accountResetRequest.create({
    data: {
      ...data,
      requestIpAddress: context.ipAddress,
      requestUserAgent: context.userAgent
    },
    include: resetRequestSafeInclude
  });

  const label = request.requestType === "guest_pin_reset" ? "guest PIN" : "password";
  await notifyActiveAdmins(
    "Reset request needs review",
    `A ${label} reset request was submitted. Review it in Admin Support & Account Controls.`,
    "warning"
  );
  return request;
}
