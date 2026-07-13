-- CreateEnum
CREATE TYPE "AdInteractionType" AS ENUM ('impression', 'click');

-- CreateTable
CREATE TABLE "AdInteraction" (
    "id" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "type" "AdInteractionType" NOT NULL,
    "placement" "AdPlacement" NOT NULL,
    "path" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sessionHash" TEXT,
    "userId" TEXT,
    "guestSessionId" TEXT,

    CONSTRAINT "AdInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdInteraction_adId_idx" ON "AdInteraction"("adId");

-- CreateIndex
CREATE INDEX "AdInteraction_type_idx" ON "AdInteraction"("type");

-- CreateIndex
CREATE INDEX "AdInteraction_createdAt_idx" ON "AdInteraction"("createdAt");

-- CreateIndex
CREATE INDEX "AdInteraction_placement_idx" ON "AdInteraction"("placement");

-- CreateIndex
CREATE INDEX "AdInteraction_adId_type_createdAt_idx" ON "AdInteraction"("adId", "type", "createdAt");

-- AddForeignKey
ALTER TABLE "AdInteraction" ADD CONSTRAINT "AdInteraction_adId_fkey" FOREIGN KEY ("adId") REFERENCES "InternalAd"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdInteraction" ADD CONSTRAINT "AdInteraction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdInteraction" ADD CONSTRAINT "AdInteraction_guestSessionId_fkey" FOREIGN KEY ("guestSessionId") REFERENCES "GuestSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
