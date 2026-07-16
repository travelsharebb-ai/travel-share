-- Additive support queue for password and guest PIN reset requests.
CREATE TYPE "ResetRequesterType" AS ENUM ('user', 'guest');
CREATE TYPE "ResetRequestType" AS ENUM ('password_reset', 'guest_pin_reset');
CREATE TYPE "ResetRequestStatus" AS ENUM ('pending', 'resolved', 'dismissed');

CREATE TABLE "AccountResetRequest" (
    "id" TEXT NOT NULL,
    "requesterType" "ResetRequesterType" NOT NULL,
    "requestType" "ResetRequestType" NOT NULL,
    "status" "ResetRequestStatus" NOT NULL DEFAULT 'pending',
    "userId" TEXT,
    "guestSessionId" TEXT,
    "guestName" TEXT,
    "contactEmail" TEXT,
    "contactNote" TEXT,
    "contextNote" TEXT,
    "message" TEXT NOT NULL,
    "requestIpAddress" TEXT,
    "requestUserAgent" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByAdminId" TEXT,
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountResetRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AccountResetRequest_status_createdAt_idx" ON "AccountResetRequest"("status", "createdAt");
CREATE INDEX "AccountResetRequest_userId_createdAt_idx" ON "AccountResetRequest"("userId", "createdAt");
CREATE INDEX "AccountResetRequest_guestSessionId_createdAt_idx" ON "AccountResetRequest"("guestSessionId", "createdAt");
CREATE INDEX "AccountResetRequest_resolvedByAdminId_idx" ON "AccountResetRequest"("resolvedByAdminId");

ALTER TABLE "AccountResetRequest" ADD CONSTRAINT "AccountResetRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccountResetRequest" ADD CONSTRAINT "AccountResetRequest_guestSessionId_fkey" FOREIGN KEY ("guestSessionId") REFERENCES "GuestSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccountResetRequest" ADD CONSTRAINT "AccountResetRequest_resolvedByAdminId_fkey" FOREIGN KEY ("resolvedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
