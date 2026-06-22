-- Drop-in migration to add download gating and audit logging support.

ALTER TABLE "Upload" ADD COLUMN IF NOT EXISTS "downloadPurchaseItemId" TEXT;
CREATE INDEX IF NOT EXISTS "Upload_downloadPurchaseItemId_idx" ON "Upload" ("downloadPurchaseItemId");
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_downloadPurchaseItemId_fkey" FOREIGN KEY ("downloadPurchaseItemId") REFERENCES "PurchaseItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "DownloadAuditLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "uploadId" TEXT NOT NULL,
  "success" BOOLEAN NOT NULL DEFAULT false,
  "reason" TEXT,
  "ip" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "DownloadAuditLog_userId_idx" ON "DownloadAuditLog" ("userId");
CREATE INDEX IF NOT EXISTS "DownloadAuditLog_uploadId_idx" ON "DownloadAuditLog" ("uploadId");
ALTER TABLE "DownloadAuditLog" ADD CONSTRAINT "DownloadAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DownloadAuditLog" ADD CONSTRAINT "DownloadAuditLog_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload"("id") ON DELETE CASCADE ON UPDATE CASCADE;
