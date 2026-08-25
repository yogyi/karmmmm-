-- Overseas KYC: company-domain email OTP (GST substitute abroad)
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "business_email_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "business_email_otp_hash" TEXT;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "business_email_otp_expires_at" TIMESTAMP(3);
