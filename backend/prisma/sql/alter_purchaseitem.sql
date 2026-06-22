ALTER TABLE "PurchaseItem" ADD COLUMN IF NOT EXISTS "title" TEXT;
ALTER TABLE "PurchaseItem" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "PurchaseItem" ADD COLUMN IF NOT EXISTS "price" INTEGER;
-- Add enum-typed column only if type exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'storeitemtype') THEN
    BEGIN
      ALTER TABLE "PurchaseItem" ADD COLUMN IF NOT EXISTS "type" "StoreItemType";
    EXCEPTION WHEN others THEN
      -- ignore
    END;
  END IF;
END$$;
ALTER TABLE "PurchaseItem" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "PurchaseItem" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
