-- CreateEnum
CREATE TYPE "QRTargetType" AS ENUM ('general', 'event', 'trip', 'album', 'location');

-- CreateEnum
CREATE TYPE "QRVisibility" AS ENUM ('public', 'private', 'unlisted');

-- AlterTable
ALTER TABLE "Upload" ADD COLUMN     "qrUploadSpaceId" TEXT;

-- CreateTable
CREATE TABLE "QRUploadSpace" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "targetType" "QRTargetType" NOT NULL,
    "targetId" TEXT,
    "createdByUserId" TEXT,
    "guestSessionId" TEXT,
    "visibility" "QRVisibility" NOT NULL DEFAULT 'unlisted',
    "expiresAt" TIMESTAMP(3),
    "allowGuests" BOOLEAN NOT NULL DEFAULT true,
    "allowRegisteredUsers" BOOLEAN NOT NULL DEFAULT true,
    "requireApproval" BOOLEAN NOT NULL DEFAULT true,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "locationName" TEXT,
    "disabledAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "scanCount" INTEGER NOT NULL DEFAULT 0,
    "lastScannedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QRUploadSpace_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QRUploadSpace_token_key" ON "QRUploadSpace"("token");

-- CreateIndex
CREATE INDEX "QRUploadSpace_token_idx" ON "QRUploadSpace"("token");

-- CreateIndex
CREATE INDEX "QRUploadSpace_createdByUserId_idx" ON "QRUploadSpace"("createdByUserId");

-- CreateIndex
CREATE INDEX "QRUploadSpace_guestSessionId_idx" ON "QRUploadSpace"("guestSessionId");

-- CreateIndex
CREATE INDEX "QRUploadSpace_targetType_targetId_idx" ON "QRUploadSpace"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "QRUploadSpace_expiresAt_idx" ON "QRUploadSpace"("expiresAt");

-- CreateIndex
CREATE INDEX "QRUploadSpace_deletedAt_idx" ON "QRUploadSpace"("deletedAt");

-- CreateIndex
CREATE INDEX "Upload_qrUploadSpaceId_idx" ON "Upload"("qrUploadSpaceId");

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_qrUploadSpaceId_fkey" FOREIGN KEY ("qrUploadSpaceId") REFERENCES "QRUploadSpace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QRUploadSpace" ADD CONSTRAINT "QRUploadSpace_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QRUploadSpace" ADD CONSTRAINT "QRUploadSpace_guestSessionId_fkey" FOREIGN KEY ("guestSessionId") REFERENCES "GuestSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
