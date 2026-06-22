ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "activeStoreItemId" TEXT;

ALTER TABLE "Trip" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "guestSessionId" TEXT;

ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "guestSessionId" TEXT;

CREATE INDEX IF NOT EXISTS "User_activeStoreItemId_idx" ON "User"("activeStoreItemId");
CREATE INDEX IF NOT EXISTS "Trip_userId_idx" ON "Trip"("userId");
CREATE INDEX IF NOT EXISTS "Trip_guestSessionId_idx" ON "Trip"("guestSessionId");
CREATE INDEX IF NOT EXISTS "Event_guestSessionId_idx" ON "Event"("guestSessionId");

DO $$ BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_activeStoreItemId_fkey" FOREIGN KEY ("activeStoreItemId") REFERENCES "PurchaseItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Trip" ADD CONSTRAINT "Trip_guestSessionId_fkey" FOREIGN KEY ("guestSessionId") REFERENCES "GuestSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Event" ADD CONSTRAINT "Event_guestSessionId_fkey" FOREIGN KEY ("guestSessionId") REFERENCES "GuestSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
