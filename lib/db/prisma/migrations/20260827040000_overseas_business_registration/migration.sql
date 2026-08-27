-- Overseas KYC: business registration document + reference number (replaces GST for foreign sellers).
ALTER TABLE "suppliers"
ADD COLUMN IF NOT EXISTS "business_registration_document_url" TEXT,
ADD COLUMN IF NOT EXISTS "business_registration_number" TEXT;
