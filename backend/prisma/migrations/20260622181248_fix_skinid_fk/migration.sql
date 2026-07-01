ALTER TABLE "Upload" ADD COLUMN IF NOT EXISTS "skinId" TEXT;

CREATE TABLE IF NOT EXISTS "UserSkinUnlock" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "skinId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserSkinUnlock_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "UserSkinUnlock_userId_idx" ON "UserSkinUnlock"("userId");
CREATE INDEX IF NOT EXISTS "UserSkinUnlock_skinId_idx" ON "UserSkinUnlock"("skinId");
CREATE UNIQUE INDEX IF NOT EXISTS "UserSkinUnlock_userId_skinId_key" ON "UserSkinUnlock"("userId", "skinId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Upload_skinId_fkey') THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'Upload' AND column_name = 'skinId'
    ) THEN
      ALTER TABLE "Upload" ADD CONSTRAINT "Upload_skinId_fkey" FOREIGN KEY ("skinId") REFERENCES "PurchaseItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'UserSkinUnlock'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserSkinUnlock_userId_fkey') THEN
      ALTER TABLE "UserSkinUnlock" ADD CONSTRAINT "UserSkinUnlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserSkinUnlock_skinId_fkey') THEN
      ALTER TABLE "UserSkinUnlock" ADD CONSTRAINT "UserSkinUnlock_skinId_fkey" FOREIGN KEY ("skinId") REFERENCES "PurchaseItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;
END$$;
