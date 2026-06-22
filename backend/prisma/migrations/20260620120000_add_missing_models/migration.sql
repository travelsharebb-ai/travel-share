-- Production reconciliation for schema objects added outside the original
-- migration chain. This migration is intentionally additive/idempotent so
-- `prisma migrate deploy` can run safely on databases that already received
-- some of these objects from previous hotfix migrations.

ALTER TYPE "StoreItemType" ADD VALUE IF NOT EXISTS 'download_asset';

ALTER TABLE "PurchaseItem" ADD COLUMN IF NOT EXISTS "sku" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseItem_sku_key" ON "PurchaseItem"("sku");

ALTER TABLE "EmailNotificationLog" ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "EmailNotificationLog" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "EmailNotificationLog" ALTER COLUMN "toEmail" DROP NOT NULL;
ALTER TABLE "EmailNotificationLog" ALTER COLUMN "provider" DROP NOT NULL;
CREATE INDEX IF NOT EXISTS "EmailNotificationLog_template_idx" ON "EmailNotificationLog"("template");

ALTER TABLE "DownloadAuditLog" ADD COLUMN IF NOT EXISTS "id" TEXT;
UPDATE "DownloadAuditLog"
SET "id" = 'download_audit_' || md5(coalesce("userId", '') || ':' || coalesce("uploadId", '') || ':' || coalesce("ip", '') || ':' || "createdAt"::text)
WHERE "id" IS NULL;
ALTER TABLE "DownloadAuditLog" ALTER COLUMN "id" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = '"DownloadAuditLog"'::regclass
      AND contype = 'p'
  ) THEN
    ALTER TABLE "DownloadAuditLog" ADD CONSTRAINT "DownloadAuditLog_pkey" PRIMARY KEY ("id");
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DownloadAuditLog_userId_fkey'
  ) THEN
    ALTER TABLE "DownloadAuditLog" DROP CONSTRAINT "DownloadAuditLog_userId_fkey";
  END IF;
  ALTER TABLE "DownloadAuditLog" ADD CONSTRAINT "DownloadAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
END$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DownloadAuditLog_uploadId_fkey'
  ) THEN
    ALTER TABLE "DownloadAuditLog" DROP CONSTRAINT "DownloadAuditLog_uploadId_fkey";
  END IF;
  ALTER TABLE "DownloadAuditLog" ADD CONSTRAINT "DownloadAuditLog_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload"("id") ON DELETE SET NULL ON UPDATE CASCADE;
END$$;

ALTER TABLE "DownloadAuditLog" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "DownloadAuditLog" ALTER COLUMN "uploadId" DROP NOT NULL;

ALTER TABLE "PlatformSetting" ADD COLUMN IF NOT EXISTS "id" TEXT;
UPDATE "PlatformSetting"
SET "id" = 'platform_setting_' || md5("key")
WHERE "id" IS NULL;
ALTER TABLE "PlatformSetting" ALTER COLUMN "id" SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PlatformSetting_pkey'
  ) THEN
    ALTER TABLE "PlatformSetting" DROP CONSTRAINT "PlatformSetting_pkey";
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = '"PlatformSetting"'::regclass
      AND contype = 'p'
  ) THEN
    ALTER TABLE "PlatformSetting" ADD CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("id");
  END IF;
END$$;

CREATE UNIQUE INDEX IF NOT EXISTS "PlatformSetting_key_key" ON "PlatformSetting"("key");

CREATE TABLE IF NOT EXISTS "UploadState" (
  "id" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "reservedToken" TEXT,
  "filePublicId" TEXT,
  "storageKey" TEXT,
  "storageProvider" TEXT,
  "entityId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "fingerprint" TEXT,
  "uploadId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UploadState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UploadState_idempotencyKey_key" ON "UploadState"("idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "UploadState_reservedToken_key" ON "UploadState"("reservedToken");
CREATE UNIQUE INDEX IF NOT EXISTS "UploadState_uploadId_key" ON "UploadState"("uploadId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UploadState_uploadId_fkey'
  ) THEN
    ALTER TABLE "UploadState" ADD CONSTRAINT "UploadState_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS "UploadRetryJob" (
  "id" TEXT NOT NULL,
  "uploadStateId" TEXT NOT NULL,
  "filePublicId" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "nextAttemptAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UploadRetryJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "UploadRetryJob_uploadStateId_idx" ON "UploadRetryJob"("uploadStateId");
CREATE INDEX IF NOT EXISTS "UploadRetryJob_nextAttemptAt_idx" ON "UploadRetryJob"("nextAttemptAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UploadRetryJob_uploadStateId_fkey'
  ) THEN
    ALTER TABLE "UploadRetryJob" ADD CONSTRAINT "UploadRetryJob_uploadStateId_fkey" FOREIGN KEY ("uploadStateId") REFERENCES "UploadState"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;
