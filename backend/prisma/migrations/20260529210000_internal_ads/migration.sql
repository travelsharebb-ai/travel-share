-- Additive migration for internal admin-controlled image/video ads.
-- Production safety: deploy with `prisma migrate deploy`.
-- Never run `prisma migrate reset` against production data.

CREATE TYPE "AdMediaType" AS ENUM ('image', 'video');

CREATE TABLE "InternalAd" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "mediaUrl" TEXT NOT NULL,
    "mediaType" "AdMediaType" NOT NULL,
    "linkUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "displaySeconds" INTEGER NOT NULL DEFAULT 12,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InternalAd_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InternalAd_active_priority_idx" ON "InternalAd"("active", "priority");
CREATE INDEX "InternalAd_startsAt_endsAt_idx" ON "InternalAd"("startsAt", "endsAt");

ALTER TABLE "InternalAd" ADD CONSTRAINT "InternalAd_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
