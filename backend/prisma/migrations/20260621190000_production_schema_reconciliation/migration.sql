-- Forward-only production reconciliation from the applied migration history to
-- the current Prisma schema contract. This intentionally avoids assumptions
-- about which hotfix migrations created each object.

ALTER TYPE "StoreItemType" ADD VALUE IF NOT EXISTS 'download_asset';

ALTER TABLE "GuestSession" ALTER COLUMN "deviceFingerprint" DROP NOT NULL;
ALTER TABLE "GuestSession" ALTER COLUMN "scopeType" DROP NOT NULL;
ALTER TABLE "GuestSession" ALTER COLUMN "scopeId" DROP NOT NULL;

ALTER TABLE "InternalAd" ALTER COLUMN "displaySeconds" DROP NOT NULL;
ALTER TABLE "InternalAd" ALTER COLUMN "displaySeconds" DROP DEFAULT;
CREATE INDEX IF NOT EXISTS "InternalAd_createdById_idx" ON "InternalAd"("createdById");

ALTER TABLE "Location" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "Upload" ALTER COLUMN "uploaderFingerprint" DROP NOT NULL;
CREATE INDEX IF NOT EXISTS "Upload_locationId_idx" ON "Upload"("locationId");

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Upload_locationId_fkey') THEN
    ALTER TABLE "Upload" DROP CONSTRAINT "Upload_locationId_fkey";
  END IF;
  ALTER TABLE "Upload" ADD CONSTRAINT "Upload_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Upload_skinId_fkey') THEN
    ALTER TABLE "Upload" ADD CONSTRAINT "Upload_skinId_fkey" FOREIGN KEY ("skinId") REFERENCES "PurchaseItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Trip_userId_fkey') THEN
    ALTER TABLE "Trip" DROP CONSTRAINT "Trip_userId_fkey";
  END IF;
  ALTER TABLE "Trip" ADD CONSTRAINT "Trip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Location_userId_fkey') THEN
    ALTER TABLE "Location" ADD CONSTRAINT "Location_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

ALTER TABLE "ShareLink" ADD COLUMN IF NOT EXISTS "eventId" TEXT;
ALTER TABLE "ShareLink" ALTER COLUMN "tripId" DROP NOT NULL;
CREATE INDEX IF NOT EXISTS "ShareLink_tripId_idx" ON "ShareLink"("tripId");
CREATE INDEX IF NOT EXISTS "ShareLink_eventId_idx" ON "ShareLink"("eventId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ShareLink_eventId_fkey') THEN
    ALTER TABLE "ShareLink" ADD CONSTRAINT "ShareLink_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

ALTER TABLE "EmailNotificationLog" ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "EmailNotificationLog" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "EmailNotificationLog" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "EmailNotificationLog" ALTER COLUMN "toEmail" DROP NOT NULL;
ALTER TABLE "EmailNotificationLog" ALTER COLUMN "provider" DROP NOT NULL;
CREATE INDEX IF NOT EXISTS "EmailNotificationLog_template_idx" ON "EmailNotificationLog"("template");

ALTER TABLE "DownloadAuditLog" ADD COLUMN IF NOT EXISTS "id" TEXT;
UPDATE "DownloadAuditLog"
SET "id" = 'download_audit_' || md5(coalesce("userId", '') || ':' || coalesce("uploadId", '') || ':' || coalesce("ip", '') || ':' || "createdAt"::text)
WHERE "id" IS NULL;
ALTER TABLE "DownloadAuditLog" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "DownloadAuditLog" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "DownloadAuditLog" ALTER COLUMN "uploadId" DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"DownloadAuditLog"'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "DownloadAuditLog" ADD CONSTRAINT "DownloadAuditLog_pkey" PRIMARY KEY ("id");
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DownloadAuditLog_userId_fkey') THEN
    ALTER TABLE "DownloadAuditLog" DROP CONSTRAINT "DownloadAuditLog_userId_fkey";
  END IF;
  ALTER TABLE "DownloadAuditLog" ADD CONSTRAINT "DownloadAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DownloadAuditLog_uploadId_fkey') THEN
    ALTER TABLE "DownloadAuditLog" DROP CONSTRAINT "DownloadAuditLog_uploadId_fkey";
  END IF;
  ALTER TABLE "DownloadAuditLog" ADD CONSTRAINT "DownloadAuditLog_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload"("id") ON DELETE SET NULL ON UPDATE CASCADE;
END$$;

ALTER TABLE "PlatformSetting" ADD COLUMN IF NOT EXISTS "id" TEXT;
UPDATE "PlatformSetting"
SET "id" = 'platform_setting_' || md5("key")
WHERE "id" IS NULL;
ALTER TABLE "PlatformSetting" ALTER COLUMN "id" SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlatformSetting_pkey') THEN
    ALTER TABLE "PlatformSetting" DROP CONSTRAINT "PlatformSetting_pkey";
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"PlatformSetting"'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "PlatformSetting" ADD CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("id");
  END IF;
END$$;

CREATE UNIQUE INDEX IF NOT EXISTS "PlatformSetting_key_key" ON "PlatformSetting"("key");

ALTER TABLE "PurchaseItem" ADD COLUMN IF NOT EXISTS "sku" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseItem_sku_key" ON "PurchaseItem"("sku");
ALTER TABLE "PurchaseItem" DROP COLUMN IF EXISTS "title";
ALTER TABLE "PurchaseItem" DROP COLUMN IF EXISTS "price";

ALTER TABLE "PaymentTransaction" DROP COLUMN IF EXISTS "currency";
DROP INDEX IF EXISTS "PaymentTransaction_provider_providerRef_idx";
DROP INDEX IF EXISTS "PaymentTransaction_status_idx";
CREATE INDEX IF NOT EXISTS "PaymentTransaction_itemId_idx" ON "PaymentTransaction"("itemId");
CREATE INDEX IF NOT EXISTS "PaymentTransaction_providerRef_idx" ON "PaymentTransaction"("providerRef");

DROP INDEX IF EXISTS "TripChapter_tripId_createdAt_idx";
CREATE INDEX IF NOT EXISTS "TripChapter_tripId_idx" ON "TripChapter"("tripId");
DROP INDEX IF EXISTS "UserPreference_userId_idx";

ALTER TABLE "UserSkinUnlock" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "UserSkinUnlock" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "UserSkinUnlock" DROP COLUMN IF EXISTS "purchasedAt";
CREATE UNIQUE INDEX IF NOT EXISTS "UserSkinUnlock_userId_skinId_key" ON "UserSkinUnlock"("userId", "skinId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserSkinUnlock_userId_fkey') THEN
    ALTER TABLE "UserSkinUnlock" ADD CONSTRAINT "UserSkinUnlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserSkinUnlock_skinId_fkey') THEN
    ALTER TABLE "UserSkinUnlock" ADD CONSTRAINT "UserSkinUnlock_skinId_fkey" FOREIGN KEY ("skinId") REFERENCES "PurchaseItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS "AdminModerationLog_uploadId_idx" ON "AdminModerationLog"("uploadId");
CREATE INDEX IF NOT EXISTS "AdminModerationLog_adminId_idx" ON "AdminModerationLog"("adminId");
CREATE INDEX IF NOT EXISTS "UserPurchase_itemId_idx" ON "UserPurchase"("itemId");

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
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UploadState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UploadState_idempotencyKey_key" ON "UploadState"("idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "UploadState_reservedToken_key" ON "UploadState"("reservedToken");
CREATE UNIQUE INDEX IF NOT EXISTS "UploadState_uploadId_key" ON "UploadState"("uploadId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UploadState_uploadId_fkey') THEN
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
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UploadRetryJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "UploadRetryJob_uploadStateId_idx" ON "UploadRetryJob"("uploadStateId");
CREATE INDEX IF NOT EXISTS "UploadRetryJob_nextAttemptAt_idx" ON "UploadRetryJob"("nextAttemptAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UploadRetryJob_uploadStateId_fkey') THEN
    ALTER TABLE "UploadRetryJob" ADD CONSTRAINT "UploadRetryJob_uploadStateId_fkey" FOREIGN KEY ("uploadStateId") REFERENCES "UploadState"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;
