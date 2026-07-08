/*
  Warnings:

  - A unique constraint covering the columns `[emailChangeTokenHash]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "AdminModerationLog_adminId_idx";

-- DropIndex
DROP INDEX "AdminModerationLog_uploadId_idx";

-- DropIndex
DROP INDEX "InternalAd_createdById_idx";

-- DropIndex
DROP INDEX "PaymentTransaction_itemId_idx";

-- DropIndex
DROP INDEX "PaymentTransaction_providerRef_idx";

-- DropIndex
DROP INDEX "TripChapter_tripId_idx";

-- DropIndex
DROP INDEX "UserPurchase_itemId_idx";

-- AlterTable
ALTER TABLE "UploadRetryJob" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "UploadState" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailChangeTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "emailChangeTokenHash" TEXT,
ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "pendingEmail" TEXT;

-- CreateIndex
CREATE INDEX "PaymentTransaction_provider_providerRef_idx" ON "PaymentTransaction"("provider", "providerRef");

-- CreateIndex
CREATE INDEX "PaymentTransaction_status_idx" ON "PaymentTransaction"("status");

-- CreateIndex
CREATE INDEX "TripChapter_tripId_createdAt_idx" ON "TripChapter"("tripId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_emailChangeTokenHash_key" ON "User"("emailChangeTokenHash");

-- CreateIndex
CREATE INDEX "UserPreference_userId_idx" ON "UserPreference"("userId");
