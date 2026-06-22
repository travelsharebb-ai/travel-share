ALTER TABLE "PurchaseItem" ADD COLUMN IF NOT EXISTS "sku" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseItem_sku_key" ON "PurchaseItem"("sku");
