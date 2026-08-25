-- Competitive quotes + deal close fields for RFQ lifecycle
ALTER TABLE "rfq" ADD COLUMN IF NOT EXISTS "awarded_quote_id" INTEGER;
ALTER TABLE "rfq" ADD COLUMN IF NOT EXISTS "closed_at" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "rfq_quotes" (
    "id" SERIAL NOT NULL,
    "rfq_id" INTEGER NOT NULL,
    "supplier_id" INTEGER NOT NULL,
    "supplier_name" TEXT NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "quantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "lead_time_days" INTEGER,
    "valid_days" INTEGER,
    "payment_terms" TEXT,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rfq_quotes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "rfq_quotes_rfq_id_supplier_id_key" ON "rfq_quotes"("rfq_id", "supplier_id");
CREATE INDEX IF NOT EXISTS "rfq_quotes_rfq_id_status_idx" ON "rfq_quotes"("rfq_id", "status");
CREATE INDEX IF NOT EXISTS "rfq_quotes_supplier_id_idx" ON "rfq_quotes"("supplier_id");

DO $$ BEGIN
  ALTER TABLE "rfq_quotes" ADD CONSTRAINT "rfq_quotes_rfq_id_fkey"
    FOREIGN KEY ("rfq_id") REFERENCES "rfq"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "rfq_quotes" ADD CONSTRAINT "rfq_quotes_supplier_id_fkey"
    FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "rfq" ADD CONSTRAINT "rfq_awarded_quote_id_fkey"
    FOREIGN KEY ("awarded_quote_id") REFERENCES "rfq_quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Backfill legacy single-quote RFQs into rfq_quotes when a supplier + price exist
INSERT INTO "rfq_quotes" (
  "rfq_id", "supplier_id", "supplier_name", "unit_price", "currency",
  "quantity", "unit", "message", "status", "created_at", "updated_at"
)
SELECT
  r.id,
  r.supplier_id,
  COALESCE(r.supplier_name, 'Supplier'),
  r.quoted_price,
  'INR',
  r.quantity,
  r.unit,
  r.seller_message,
  CASE
    WHEN r.status = 'accepted' THEN 'awarded'
    WHEN r.status = 'rejected' THEN 'declined'
    ELSE 'active'
  END,
  COALESCE(r.quoted_at, r.created_at),
  COALESCE(r.quoted_at, r.created_at)
FROM "rfq" r
WHERE r.supplier_id IS NOT NULL
  AND r.quoted_price IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "rfq_quotes" q WHERE q.rfq_id = r.id AND q.supplier_id = r.supplier_id
  );

UPDATE "rfq" r
SET "awarded_quote_id" = q.id,
    "closed_at" = COALESCE(r.closed_at, r.quoted_at, NOW())
FROM "rfq_quotes" q
WHERE r.status = 'accepted'
  AND r.awarded_quote_id IS NULL
  AND q.rfq_id = r.id
  AND q.status = 'awarded';
