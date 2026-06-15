CREATE TABLE IF NOT EXISTS "TripChapter" (
  "id" TEXT NOT NULL,
  "tripId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TripChapter_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TripChapter_tripId_createdAt_idx" ON "TripChapter"("tripId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "TripChapter" ADD CONSTRAINT "TripChapter_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
