-- Overseas buyer KYC: company email + WhatsApp OTP, then registration / country / website.
-- No document uploads. Existing accounts are grandfathered so India buyers stay unblocked.

ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "buyer_country" TEXT,
ADD COLUMN IF NOT EXISTS "buyer_company_email" TEXT,
ADD COLUMN IF NOT EXISTS "buyer_company_email_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "buyer_company_email_otp_hash" TEXT,
ADD COLUMN IF NOT EXISTS "buyer_company_email_otp_expires_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "buyer_whatsapp" TEXT,
ADD COLUMN IF NOT EXISTS "buyer_whatsapp_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "buyer_whatsapp_otp_hash" TEXT,
ADD COLUMN IF NOT EXISTS "buyer_whatsapp_otp_expires_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "buyer_registration_number" TEXT,
ADD COLUMN IF NOT EXISTS "buyer_website" TEXT,
ADD COLUMN IF NOT EXISTS "buyer_kyc_completed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "buyer_kyc_completed_at" TIMESTAMP(3);

UPDATE "users"
SET "buyer_kyc_completed" = true,
    "buyer_kyc_completed_at" = COALESCE("buyer_kyc_completed_at", NOW())
WHERE "buyer_kyc_completed" = false
  AND "onboarding_completed" = true;
