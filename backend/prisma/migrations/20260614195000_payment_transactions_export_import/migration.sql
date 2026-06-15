DO $$ BEGIN
  CREATE TYPE "PaymentProvider" AS ENUM ('stripe', 'paypal');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'paid', 'canceled', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "PaymentTransaction" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "provider" "PaymentProvider" NOT NULL,
  "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'usd',
  "providerRef" TEXT,
  "checkoutUrl" TEXT,
  "rawResponse" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PaymentTransaction_userId_idx" ON "PaymentTransaction"("userId");
CREATE INDEX IF NOT EXISTS "PaymentTransaction_provider_providerRef_idx" ON "PaymentTransaction"("provider", "providerRef");
CREATE INDEX IF NOT EXISTS "PaymentTransaction_status_idx" ON "PaymentTransaction"("status");

DO $$ BEGIN
  ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "PurchaseItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
