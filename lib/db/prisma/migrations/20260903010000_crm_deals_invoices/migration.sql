-- CRM expansion from KARM BABA CRM Excel sheets:
--   KARM LEADS MASTER, QUOTATIONS, COMMUNICATION LOG, DEALS, INVOICING
--   + CRM SYSTEM 1 (HOT/WARM/COLD, requirements, attachments)

-- Lead columns
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "first_name" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "last_name" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "requirements_gathered" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "lead_type" TEXT NOT NULL DEFAULT 'warm';
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "industry_insights" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "karm_ai_action" TEXT;

CREATE INDEX IF NOT EXISTS "leads_supplier_id_lead_type_idx" ON "leads"("supplier_id", "lead_type");
CREATE INDEX IF NOT EXISTS "leads_supplier_id_deal_status_idx" ON "leads"("supplier_id", "deal_status");
CREATE INDEX IF NOT EXISTS "leads_follow_up_at_idx" ON "leads"("follow_up_at");

-- Communication log extras
ALTER TABLE "lead_activities" ADD COLUMN IF NOT EXISTS "log_code" TEXT;
ALTER TABLE "lead_activities" ADD COLUMN IF NOT EXISTS "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE UNIQUE INDEX IF NOT EXISTS "lead_activities_log_code_key" ON "lead_activities"("log_code");
DROP INDEX IF EXISTS "lead_activities_lead_id_idx";
CREATE INDEX IF NOT EXISTS "lead_activities_lead_id_occurred_at_idx" ON "lead_activities"("lead_id", "occurred_at");

-- Quotation extras
ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "quote_code" TEXT;
ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "company_name" TEXT;
ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "customisation" TEXT;
ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "sent_at" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "quotations_quote_code_key" ON "quotations"("quote_code");
CREATE INDEX IF NOT EXISTS "quotations_status_idx" ON "quotations"("status");

-- Deals
CREATE TABLE IF NOT EXISTS "crm_deals" (
    "id" SERIAL NOT NULL,
    "deal_code" TEXT NOT NULL,
    "lead_id" INTEGER NOT NULL,
    "quotation_id" INTEGER,
    "supplier_id" INTEGER,
    "company_name" TEXT,
    "product_name" TEXT NOT NULL,
    "final_quantity" INTEGER,
    "final_price" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "incoterms" TEXT,
    "deal_value" DECIMAL(14,2),
    "order_date" TIMESTAMP(3),
    "dispatch_status" TEXT NOT NULL DEFAULT 'pending',
    "payment_terms" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "crm_deals_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "crm_deals_deal_code_key" ON "crm_deals"("deal_code");
CREATE INDEX IF NOT EXISTS "crm_deals_lead_id_idx" ON "crm_deals"("lead_id");
CREATE INDEX IF NOT EXISTS "crm_deals_supplier_id_status_idx" ON "crm_deals"("supplier_id", "status");
CREATE INDEX IF NOT EXISTS "crm_deals_dispatch_status_idx" ON "crm_deals"("dispatch_status");

-- Invoices
CREATE TABLE IF NOT EXISTS "crm_invoices" (
    "id" SERIAL NOT NULL,
    "invoice_code" TEXT NOT NULL,
    "deal_id" INTEGER NOT NULL,
    "company_name" TEXT,
    "invoice_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "payment_status" TEXT NOT NULL DEFAULT 'unpaid',
    "payment_mode" TEXT,
    "due_date" TIMESTAMP(3),
    "received_date" TIMESTAMP(3),
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "crm_invoices_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "crm_invoices_invoice_code_key" ON "crm_invoices"("invoice_code");
CREATE INDEX IF NOT EXISTS "crm_invoices_deal_id_idx" ON "crm_invoices"("deal_id");
CREATE INDEX IF NOT EXISTS "crm_invoices_payment_status_idx" ON "crm_invoices"("payment_status");
CREATE INDEX IF NOT EXISTS "crm_invoices_due_date_idx" ON "crm_invoices"("due_date");

-- Attachments
CREATE TABLE IF NOT EXISTS "crm_attachments" (
    "id" SERIAL NOT NULL,
    "lead_id" INTEGER,
    "quotation_id" INTEGER,
    "deal_id" INTEGER,
    "invoice_id" INTEGER,
    "kind" TEXT NOT NULL DEFAULT 'document',
    "file_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "mime_type" TEXT,
    "uploaded_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "crm_attachments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "crm_attachments_lead_id_idx" ON "crm_attachments"("lead_id");
CREATE INDEX IF NOT EXISTS "crm_attachments_deal_id_idx" ON "crm_attachments"("deal_id");

-- Foreign keys
DO $$ BEGIN
  ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_lead_id_fkey"
    FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_quotation_id_fkey"
    FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_supplier_id_fkey"
    FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "crm_invoices" ADD CONSTRAINT "crm_invoices_deal_id_fkey"
    FOREIGN KEY ("deal_id") REFERENCES "crm_deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "crm_attachments" ADD CONSTRAINT "crm_attachments_lead_id_fkey"
    FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "crm_attachments" ADD CONSTRAINT "crm_attachments_quotation_id_fkey"
    FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "crm_attachments" ADD CONSTRAINT "crm_attachments_deal_id_fkey"
    FOREIGN KEY ("deal_id") REFERENCES "crm_deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "crm_attachments" ADD CONSTRAINT "crm_attachments_invoice_id_fkey"
    FOREIGN KEY ("invoice_id") REFERENCES "crm_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
