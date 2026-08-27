-- GST certificate OCR (RapidAPI) — required for public Verified badge.
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "gst_certificate_document_url" TEXT;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "gst_certificate_ocr_verified_at" TIMESTAMP(3);
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "gst_certificate_ocr_gstin" TEXT;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "gst_certificate_ocr_legal_name" TEXT;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "gst_certificate_ocr_raw" TEXT;
