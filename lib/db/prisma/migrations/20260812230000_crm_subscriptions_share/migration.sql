-- AlterTable suppliers: shareable profile
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "slug" TEXT;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "video_url" TEXT;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "share_image_url" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "suppliers_slug_key" ON "suppliers"("slug");

-- CreateTable plans
CREATE TABLE IF NOT EXISTS "plans" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "max_products" INTEGER NOT NULL DEFAULT 3,
    "monthly_lead_quota" INTEGER NOT NULL DEFAULT 10,
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "price_inr_monthly" INTEGER,
    "price_inr_yearly" INTEGER,
    "price_usd_monthly" INTEGER,
    "price_usd_yearly" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "plans_code_key" ON "plans"("code");

-- CreateTable shop_subscriptions
CREATE TABLE IF NOT EXISTS "shop_subscriptions" (
    "id" SERIAL NOT NULL,
    "supplier_id" INTEGER NOT NULL,
    "plan_code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "region" TEXT NOT NULL DEFAULT 'inr',
    "period_start" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "period_end" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shop_subscriptions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "shop_subscriptions_supplier_id_key" ON "shop_subscriptions"("supplier_id");

-- CreateTable leads
CREATE TABLE IF NOT EXISTS "leads" (
    "id" SERIAL NOT NULL,
    "karm_id" TEXT NOT NULL,
    "supplier_id" INTEGER,
    "buyer_id" INTEGER,
    "rfq_id" INTEGER,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "country" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "product_interest" TEXT,
    "avg_monthly_qty" TEXT,
    "lead_source" TEXT,
    "requirement_status" TEXT NOT NULL DEFAULT 'new',
    "quotation_sent" BOOLEAN NOT NULL DEFAULT false,
    "deal_status" TEXT NOT NULL DEFAULT 'open',
    "follow_up_at" TIMESTAMP(3),
    "assigned_to" TEXT,
    "comments" TEXT,
    "lost_reason" TEXT,
    "industry" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "leads_karm_id_key" ON "leads"("karm_id");
CREATE UNIQUE INDEX IF NOT EXISTS "leads_rfq_id_key" ON "leads"("rfq_id");
CREATE INDEX IF NOT EXISTS "leads_supplier_id_requirement_status_idx" ON "leads"("supplier_id", "requirement_status");

-- CreateTable lead_activities
CREATE TABLE IF NOT EXISTS "lead_activities" (
    "id" SERIAL NOT NULL,
    "lead_id" INTEGER NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'note',
    "subject" TEXT,
    "summary" TEXT NOT NULL,
    "next_action" TEXT,
    "follow_up_at" TIMESTAMP(3),
    "handled_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lead_activities_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "lead_activities_lead_id_idx" ON "lead_activities"("lead_id");

-- CreateTable quotations
CREATE TABLE IF NOT EXISTS "quotations" (
    "id" SERIAL NOT NULL,
    "lead_id" INTEGER NOT NULL,
    "product_name" TEXT NOT NULL,
    "quantity" INTEGER,
    "unit_price" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "incoterms" TEXT,
    "valid_till" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sent_via" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "quotations_lead_id_idx" ON "quotations"("lead_id");

-- FKs
DO $$ BEGIN
  ALTER TABLE "shop_subscriptions" ADD CONSTRAINT "shop_subscriptions_supplier_id_fkey"
    FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "shop_subscriptions" ADD CONSTRAINT "shop_subscriptions_plan_code_fkey"
    FOREIGN KEY ("plan_code") REFERENCES "plans"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "leads" ADD CONSTRAINT "leads_supplier_id_fkey"
    FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "leads" ADD CONSTRAINT "leads_buyer_id_fkey"
    FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "leads" ADD CONSTRAINT "leads_rfq_id_fkey"
    FOREIGN KEY ("rfq_id") REFERENCES "rfq"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_lead_id_fkey"
    FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "quotations" ADD CONSTRAINT "quotations_lead_id_fkey"
    FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seed plans (Karm Baba subscription ladder)
INSERT INTO "plans" ("code", "name", "description", "max_products", "monthly_lead_quota", "features", "price_inr_monthly", "price_inr_yearly", "price_usd_monthly", "price_usd_yearly", "sort_order")
VALUES
  ('free', 'Free', 'List up to 3 products forever', 3, 5,
    ARRAY['3 product listings','Basic shop profile','RFQ inbox'], 0, 0, 0, 0, 0),
  ('pro_trade', 'Pro Trade Boost', 'Best value for growing exporters', 50, 80,
    ARRAY['50 products','Lead insights','Shareable profile card','CRM lead inbox'], 14999, 149990, 199, 1990, 1),
  ('business_boost', 'Business Boost', 'Premium profile, more leads, RM support', 200, 330,
    ARRAY['200 products','330 leads/mo','Premium company profile','Product video','Premium CRM'], 35999, 297500, 444, 4444, 2),
  ('enterprise', 'Enterprise', 'Full funnel + dedicated success manager', 1000, 500,
    ARRAY['Unlimited-style catalog','500 leads/mo','Analytics','Events & consulting'], 60000, 480000, 777, 7777, 3)
ON CONFLICT ("code") DO NOTHING;

-- Backfill free subscriptions for existing suppliers
INSERT INTO "shop_subscriptions" ("supplier_id", "plan_code", "status", "region")
SELECT s.id, 'free', 'active', 'inr'
FROM "suppliers" s
WHERE NOT EXISTS (
  SELECT 1 FROM "shop_subscriptions" ss WHERE ss.supplier_id = s.id
);

-- Backfill slugs for existing suppliers
UPDATE "suppliers" s
SET "slug" = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(s.company_name, '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g')) || '-' || s.id
WHERE s.slug IS NULL;
