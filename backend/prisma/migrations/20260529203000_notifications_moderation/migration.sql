-- Additive migration for email notification logs and AI/media moderation results.
-- Production safety: deploy with `prisma migrate deploy`.
-- Never run `prisma migrate reset` against production data.

ALTER TABLE "Upload" ADD COLUMN "moderationProvider" TEXT;
ALTER TABLE "Upload" ADD COLUMN "moderationStatus" TEXT;
ALTER TABLE "Upload" ADD COLUMN "moderationLabels" JSONB;

CREATE TABLE "EmailNotificationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "uploadId" TEXT,
    "toEmail" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailNotificationLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailNotificationLog_userId_idx" ON "EmailNotificationLog"("userId");
CREATE INDEX "EmailNotificationLog_uploadId_idx" ON "EmailNotificationLog"("uploadId");

ALTER TABLE "EmailNotificationLog" ADD CONSTRAINT "EmailNotificationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmailNotificationLog" ADD CONSTRAINT "EmailNotificationLog_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload"("id") ON DELETE SET NULL ON UPDATE CASCADE;
