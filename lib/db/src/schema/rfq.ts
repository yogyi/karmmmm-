import { pgTable, serial, text, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const rfqTable = pgTable("rfq", {
  id: serial("id").primaryKey(),
  productId: integer("product_id"),
  productName: text("product_name").notNull(),
  supplierId: integer("supplier_id"),
  supplierName: text("supplier_name"),
  buyerId: integer("buyer_id"),
  buyerName: text("buyer_name").notNull(),
  buyerEmail: text("buyer_email").notNull(),
  quantity: integer("quantity").notNull(),
  unit: text("unit").notNull(),
  targetPrice: numeric("target_price", { precision: 12, scale: 2 }),
  description: text("description"),
  status: text("status").notNull().default("pending"),
  /** Seller quote response (IndiaMART / Alibaba style) */
  quotedPrice: numeric("quoted_price", { precision: 12, scale: 2 }),
  sellerMessage: text("seller_message"),
  quotedAt: timestamp("quoted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertRfqSchema = createInsertSchema(rfqTable).omit({ id: true, createdAt: true });
export type InsertRfq = z.infer<typeof insertRfqSchema>;
export type Rfq = typeof rfqTable.$inferSelect;
