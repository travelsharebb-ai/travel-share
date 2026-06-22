-- Add Location model and Upload.locationId relation

CREATE TABLE IF NOT EXISTS "Location" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "address" TEXT,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "userId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- Add locationId column to Upload if it does not exist
ALTER TABLE "Upload" ADD COLUMN IF NOT EXISTS "locationId" TEXT;

-- Add foreign key constraint if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Upload_locationId_fkey'
  ) THEN
    ALTER TABLE "Upload" ADD CONSTRAINT "Upload_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL;
  END IF;
END$$;

-- Index for Location.userId
CREATE INDEX IF NOT EXISTS "Location_userId_idx" ON "Location" ("userId");

-- Keep migration deterministic

