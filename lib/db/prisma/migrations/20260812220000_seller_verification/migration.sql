-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "legal_name" TEXT;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "business_address" TEXT;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "state" TEXT;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "pincode" TEXT;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "verification_status" TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "verification_step" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "verified_at" TIMESTAMP(3);
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "gstin" TEXT;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "pan" TEXT;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "gst_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "contact_person" TEXT;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "contact_phone" TEXT;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "contact_email" TEXT;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "website" TEXT;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "bank_account_name" TEXT;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "bank_ifsc" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "suppliers_gstin_key" ON "suppliers"("gstin");

-- Existing verified shops stay verified in the new status field.
UPDATE "suppliers"
SET "verification_status" = 'verified',
    "verification_step" = 5,
    "verified_at" = COALESCE("verified_at", NOW())
WHERE "verified" = true;
