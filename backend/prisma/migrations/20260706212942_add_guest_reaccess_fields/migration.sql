/*
  Warnings:

  - A unique constraint covering the columns `[resumeTokenHash]` on the table `GuestSession` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "GuestSession" ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "lastGuestAccessAt" TIMESTAMP(3),
ADD COLUMN     "passcodeHash" TEXT,
ADD COLUMN     "passcodeSetAt" TIMESTAMP(3),
ADD COLUMN     "resumeTokenHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "GuestSession_resumeTokenHash_key" ON "GuestSession"("resumeTokenHash");
