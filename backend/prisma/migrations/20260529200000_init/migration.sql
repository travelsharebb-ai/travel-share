-- Initial Travel Share schema.
-- Production safety: deploy with `prisma migrate deploy`.
-- Never run `prisma migrate reset` against production data.

CREATE TYPE "UserRole" AS ENUM ('tourist', 'admin');
CREATE TYPE "UploadStatus" AS ENUM ('pending', 'approved', 'rejected', 'reported');
CREATE TYPE "FileType" AS ENUM ('image', 'video');
CREATE TYPE "QrMode" AS ENUM ('open', 'paused', 'expired', 'revoked');

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'tourist',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "qrToken" TEXT NOT NULL,
    "qrActive" BOOLEAN NOT NULL DEFAULT true,
    "qrExpiresAt" TIMESTAMP(3),
    "qrMode" "QrMode" NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Upload" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "uploaderAnonId" TEXT NOT NULL,
    "uploaderFingerprint" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "filePublicId" TEXT NOT NULL,
    "fileType" "FileType" NOT NULL,
    "status" "UploadStatus" NOT NULL DEFAULT 'pending',
    "aiFlagged" BOOLEAN NOT NULL DEFAULT false,
    "reportReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    CONSTRAINT "Upload_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShareLink" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "pinHash" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShareLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BlockedUploader" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "uploaderFingerprint" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BlockedUploader_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdminModerationLog" (
    "id" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminModerationLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Trip_qrToken_key" ON "Trip"("qrToken");
CREATE INDEX "Upload_tripId_status_idx" ON "Upload"("tripId", "status");
CREATE INDEX "Upload_uploaderFingerprint_idx" ON "Upload"("uploaderFingerprint");
CREATE UNIQUE INDEX "ShareLink_token_key" ON "ShareLink"("token");
CREATE UNIQUE INDEX "BlockedUploader_tripId_uploaderFingerprint_key" ON "BlockedUploader"("tripId", "uploaderFingerprint");

ALTER TABLE "Trip" ADD CONSTRAINT "Trip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShareLink" ADD CONSTRAINT "ShareLink_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BlockedUploader" ADD CONSTRAINT "BlockedUploader_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminModerationLog" ADD CONSTRAINT "AdminModerationLog_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminModerationLog" ADD CONSTRAINT "AdminModerationLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
