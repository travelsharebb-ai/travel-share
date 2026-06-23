/*
  Warnings:

  - You are about to drop the column `currency` on the `PaymentTransaction` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Trip" DROP CONSTRAINT "Trip_userId_fkey";

-- DropForeignKey
ALTER TABLE "Upload" DROP CONSTRAINT "Upload_locationId_fkey";

-- DropIndex
DROP INDEX "PaymentTransaction_provider_providerRef_idx";

-- DropIndex
DROP INDEX "PaymentTransaction_status_idx";

-- DropIndex
DROP INDEX "TripChapter_tripId_createdAt_idx";

-- DropIndex
DROP INDEX "UserPreference_userId_idx";

-- AlterTable
ALTER TABLE "EmailNotificationLog" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "GuestSession" ALTER COLUMN "deviceFingerprint" DROP NOT NULL,
ALTER COLUMN "scopeType" DROP NOT NULL,
ALTER COLUMN "scopeId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "InternalAd" ALTER COLUMN "displaySeconds" DROP NOT NULL,
ALTER COLUMN "displaySeconds" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Location" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PaymentTransaction" DROP COLUMN "currency";

-- AlterTable
ALTER TABLE "ShareLink" ADD COLUMN     "eventId" TEXT,
ALTER COLUMN "tripId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Upload" ADD COLUMN     "skinId" TEXT,
ALTER COLUMN "uploaderFingerprint" DROP NOT NULL;

-- AlterTable
ALTER TABLE "UploadRetryJob" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "UploadState" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "UserSkinUnlock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "skinId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSkinUnlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserSkinUnlock_userId_idx" ON "UserSkinUnlock"("userId");

-- CreateIndex
CREATE INDEX "UserSkinUnlock_skinId_idx" ON "UserSkinUnlock"("skinId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSkinUnlock_userId_skinId_key" ON "UserSkinUnlock"("userId", "skinId");

-- CreateIndex
CREATE INDEX "AdminModerationLog_uploadId_idx" ON "AdminModerationLog"("uploadId");

-- CreateIndex
CREATE INDEX "AdminModerationLog_adminId_idx" ON "AdminModerationLog"("adminId");

-- CreateIndex
CREATE INDEX "InternalAd_createdById_idx" ON "InternalAd"("createdById");

-- CreateIndex
CREATE INDEX "PaymentTransaction_itemId_idx" ON "PaymentTransaction"("itemId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_providerRef_idx" ON "PaymentTransaction"("providerRef");

-- CreateIndex
CREATE INDEX "ShareLink_tripId_idx" ON "ShareLink"("tripId");

-- CreateIndex
CREATE INDEX "ShareLink_eventId_idx" ON "ShareLink"("eventId");

-- CreateIndex
CREATE INDEX "TripChapter_tripId_idx" ON "TripChapter"("tripId");

-- CreateIndex
CREATE INDEX "UserPurchase_itemId_idx" ON "UserPurchase"("itemId");

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_skinId_fkey" FOREIGN KEY ("skinId") REFERENCES "PurchaseItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareLink" ADD CONSTRAINT "ShareLink_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSkinUnlock" ADD CONSTRAINT "UserSkinUnlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSkinUnlock" ADD CONSTRAINT "UserSkinUnlock_skinId_fkey" FOREIGN KEY ("skinId") REFERENCES "PurchaseItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
