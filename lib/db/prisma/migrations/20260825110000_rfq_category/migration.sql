-- AlterTable
ALTER TABLE "rfq" ADD COLUMN "category_id" INTEGER;
ALTER TABLE "rfq" ADD COLUMN "category_name" TEXT;

-- AddForeignKey
ALTER TABLE "rfq" ADD CONSTRAINT "rfq_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
