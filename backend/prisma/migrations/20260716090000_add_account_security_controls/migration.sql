-- Additive account-state controls for registered users.
CREATE TYPE "AccountStatus" AS ENUM ('active', 'suspended', 'closed', 'anonymized');

ALTER TABLE "User"
ADD COLUMN "accountStatus" "AccountStatus" NOT NULL DEFAULT 'active',
ADD COLUMN "mustResetPassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "statusReason" TEXT,
ADD COLUMN "statusChangedAt" TIMESTAMP(3),
ADD COLUMN "passwordChangedAt" TIMESTAMP(3),
ADD COLUMN "anonymizedAt" TIMESTAMP(3);

-- Additive guest access-state controls. Existing guest lifecycle dates remain unchanged.
ALTER TABLE "GuestSession"
ADD COLUMN "accessRevokedAt" TIMESTAMP(3),
ADD COLUMN "pinResetRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "PasswordResetToken"
ADD COLUMN "revokedAt" TIMESTAMP(3);

CREATE TABLE "GuestPinResetToken" (
  "id" TEXT NOT NULL,
  "guestSessionId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GuestPinResetToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GuestPinResetToken_tokenHash_key" ON "GuestPinResetToken"("tokenHash");
CREATE INDEX "GuestPinResetToken_guestSessionId_idx" ON "GuestPinResetToken"("guestSessionId");
CREATE INDEX "GuestPinResetToken_expiresAt_idx" ON "GuestPinResetToken"("expiresAt");
ALTER TABLE "GuestPinResetToken" ADD CONSTRAINT "GuestPinResetToken_guestSessionId_fkey"
FOREIGN KEY ("guestSessionId") REFERENCES "GuestSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Immutable scalar actor/target references preserve security audit history through anonymization.
CREATE TABLE "AdminSecurityAuditLog" (
  "id" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  "adminEmail" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "beforeStatus" TEXT,
  "afterStatus" TEXT,
  "resetLinkGenerated" BOOLEAN NOT NULL DEFAULT false,
  "resetLinkSentTo" TEXT,
  "oldLinksRevoked" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminSecurityAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminSecurityAuditLog_adminId_createdAt_idx" ON "AdminSecurityAuditLog"("adminId", "createdAt");
CREATE INDEX "AdminSecurityAuditLog_targetType_targetId_idx" ON "AdminSecurityAuditLog"("targetType", "targetId");
CREATE INDEX "AdminSecurityAuditLog_action_createdAt_idx" ON "AdminSecurityAuditLog"("action", "createdAt");
