-- AlterTable
ALTER TABLE "rfq" ADD COLUMN IF NOT EXISTS "open_marketplace" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: historically open RFQs had null supplier_id while collecting; awarded ones now have a winner.
UPDATE "rfq"
SET "open_marketplace" = true
WHERE "supplier_id" IS NULL
   OR (
     "status" IN ('accepted', 'pending_confirm', 'responded', 'pending', 'rejected')
     AND EXISTS (
       SELECT 1 FROM "rfq_quotes" q WHERE q."rfq_id" = "rfq"."id"
     )
     AND (
       SELECT COUNT(DISTINCT q2."supplier_id") FROM "rfq_quotes" q2 WHERE q2."rfq_id" = "rfq"."id"
     ) > 1
   );
