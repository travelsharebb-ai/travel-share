/*
  Warnings:

  - A unique constraint covering the columns `[resumeCode]` on the table `GuestSession` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "GuestSession" ADD COLUMN     "resumeCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "GuestSession_resumeCode_key" ON "GuestSession"("resumeCode");
