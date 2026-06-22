ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'platform_admin';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'organizer';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'guest';

ALTER TYPE "QrMode" ADD VALUE IF NOT EXISTS 'approval_required';
ALTER TYPE "QrMode" ADD VALUE IF NOT EXISTS 'trusted';
ALTER TYPE "QrMode" ADD VALUE IF NOT EXISTS 'time_limited';
ALTER TYPE "QrMode" ADD VALUE IF NOT EXISTS 'family_safe';

DO $$ BEGIN
  CREATE TYPE "EventStatus" AS ENUM ('draft', 'live', 'ended', 'archived');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "EventVisibility" AS ENUM ('public', 'private', 'unlisted');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "CrowdStatus" AS ENUM ('low', 'moderate', 'high');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "LocationVisibility" AS ENUM ('exact', 'approximate', 'hidden');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "StoreItemType" AS ENUM ('image_skin', 'photo_frame', 'album_theme', 'event_theme', 'premium_qr', 'branded_page');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "AdPlacement" AS ENUM ('global', 'tourist', 'event', 'guest', 'map', 'upload_success');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "defaultLocationVisibility" "LocationVisibility" NOT NULL DEFAULT 'approximate';

ALTER TABLE "Upload" ALTER COLUMN "tripId" DROP NOT NULL;
ALTER TABLE "Upload" ADD COLUMN IF NOT EXISTS "eventId" TEXT;
ALTER TABLE "Upload" ADD COLUMN IF NOT EXISTS "zoneId" TEXT;
ALTER TABLE "Upload" ADD COLUMN IF NOT EXISTS "guestSessionId" TEXT;
ALTER TABLE "Upload" ADD COLUMN IF NOT EXISTS "caption" TEXT;
ALTER TABLE "Upload" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "Upload" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
ALTER TABLE "Upload" ADD COLUMN IF NOT EXISTS "approximateLatitude" DOUBLE PRECISION;
ALTER TABLE "Upload" ADD COLUMN IF NOT EXISTS "approximateLongitude" DOUBLE PRECISION;
ALTER TABLE "Upload" ADD COLUMN IF NOT EXISTS "locationName" TEXT;
ALTER TABLE "Upload" ADD COLUMN IF NOT EXISTS "region" TEXT;
ALTER TABLE "Upload" ADD COLUMN IF NOT EXISTS "locationVisibility" "LocationVisibility" NOT NULL DEFAULT 'approximate';

ALTER TABLE "InternalAd" ADD COLUMN IF NOT EXISTS "placement" "AdPlacement" NOT NULL DEFAULT 'global';

CREATE TABLE IF NOT EXISTS "GuestSession" (
  "id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "deviceFingerprint" TEXT NOT NULL,
  "scopeType" TEXT NOT NULL,
  "scopeId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "claimedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GuestSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Event" (
  "id" TEXT NOT NULL,
  "organizerId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT,
  "location" TEXT,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3),
  "visibility" "EventVisibility" NOT NULL DEFAULT 'public',
  "status" "EventStatus" NOT NULL DEFAULT 'draft',
  "coverImageUrl" TEXT,
  "qrToken" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EventMap" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "mapType" TEXT NOT NULL DEFAULT 'image',
  "imageUrl" TEXT,
  "mapboxStyle" TEXT,
  "centerLat" DOUBLE PRECISION,
  "centerLng" DOUBLE PRECISION,
  "zoom" DOUBLE PRECISION,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EventMap_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MapZone" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "description" TEXT,
  "x" DOUBLE PRECISION,
  "y" DOUBLE PRECISION,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "shape" JSONB,
  "crowdStatus" "CrowdStatus" NOT NULL DEFAULT 'low',
  "qrToken" TEXT NOT NULL,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MapZone_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PurchaseItem" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "type" "StoreItemType" NOT NULL,
  "priceCents" INTEGER NOT NULL DEFAULT 0,
  "previewUrl" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PurchaseItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "UserPurchase" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'owned',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserPurchase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GuestSession_token_key" ON "GuestSession"("token");
CREATE INDEX IF NOT EXISTS "GuestSession_scopeType_scopeId_idx" ON "GuestSession"("scopeType", "scopeId");
CREATE INDEX IF NOT EXISTS "GuestSession_expiresAt_idx" ON "GuestSession"("expiresAt");
CREATE INDEX IF NOT EXISTS "GuestSession_claimedById_idx" ON "GuestSession"("claimedById");

CREATE UNIQUE INDEX IF NOT EXISTS "Event_qrToken_key" ON "Event"("qrToken");
CREATE INDEX IF NOT EXISTS "Event_organizerId_idx" ON "Event"("organizerId");
CREATE INDEX IF NOT EXISTS "Event_status_visibility_idx" ON "Event"("status", "visibility");
CREATE INDEX IF NOT EXISTS "Event_startDate_idx" ON "Event"("startDate");

CREATE INDEX IF NOT EXISTS "EventMap_eventId_active_idx" ON "EventMap"("eventId", "active");

CREATE UNIQUE INDEX IF NOT EXISTS "MapZone_qrToken_key" ON "MapZone"("qrToken");
CREATE INDEX IF NOT EXISTS "MapZone_eventId_idx" ON "MapZone"("eventId");
CREATE INDEX IF NOT EXISTS "MapZone_crowdStatus_idx" ON "MapZone"("crowdStatus");

CREATE INDEX IF NOT EXISTS "PurchaseItem_active_type_idx" ON "PurchaseItem"("active", "type");
CREATE UNIQUE INDEX IF NOT EXISTS "UserPurchase_userId_itemId_key" ON "UserPurchase"("userId", "itemId");
CREATE INDEX IF NOT EXISTS "UserPurchase_userId_idx" ON "UserPurchase"("userId");

CREATE INDEX IF NOT EXISTS "Upload_eventId_status_idx" ON "Upload"("eventId", "status");
CREATE INDEX IF NOT EXISTS "Upload_zoneId_idx" ON "Upload"("zoneId");
CREATE INDEX IF NOT EXISTS "Upload_guestSessionId_idx" ON "Upload"("guestSessionId");

DO $$ BEGIN
  ALTER TABLE "GuestSession" ADD CONSTRAINT "GuestSession_claimedById_fkey" FOREIGN KEY ("claimedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Event" ADD CONSTRAINT "Event_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "EventMap" ADD CONSTRAINT "EventMap_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "MapZone" ADD CONSTRAINT "MapZone_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Upload" ADD CONSTRAINT "Upload_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Upload" ADD CONSTRAINT "Upload_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "MapZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Upload" ADD CONSTRAINT "Upload_guestSessionId_fkey" FOREIGN KEY ("guestSessionId") REFERENCES "GuestSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "UserPurchase" ADD CONSTRAINT "UserPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "UserPurchase" ADD CONSTRAINT "UserPurchase_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "PurchaseItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
