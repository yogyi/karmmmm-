ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "gst_live_status" TEXT;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "gst_live_verified_at" TIMESTAMP(3);
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "gst_trade_name" TEXT;
