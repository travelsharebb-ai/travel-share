-- Add skinId column to uploads and create user_skin_unlock table
ALTER TABLE "Upload" ADD COLUMN "skinId" TEXT;

CREATE TABLE IF NOT EXISTS "UserSkinUnlock" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" TEXT NOT NULL,
  "skinId" TEXT NOT NULL,
  "purchasedAt" TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "UserSkinUnlock_userId_idx" ON "UserSkinUnlock" ("userId");
CREATE INDEX IF NOT EXISTS "UserSkinUnlock_skinId_idx" ON "UserSkinUnlock" ("skinId");
