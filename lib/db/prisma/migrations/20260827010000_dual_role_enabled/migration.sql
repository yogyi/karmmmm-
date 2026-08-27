-- Dual marketplace sides: free role switch only when both are enabled.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "buyer_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "seller_enabled" BOOLEAN NOT NULL DEFAULT false;

-- Backfill from current role / shop link (history of the other side is unknown).
UPDATE "users"
SET "buyer_enabled" = true
WHERE "role" IN ('buyer', 'admin');

UPDATE "users"
SET "seller_enabled" = true
WHERE "role" IN ('seller', 'admin') OR "supplier_id" IS NOT NULL;
