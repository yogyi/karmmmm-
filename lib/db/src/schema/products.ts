import { pgTable, serial, text, integer, boolean, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  supplierId: integer("supplier_id").notNull(),
  categoryId: integer("category_id").notNull(),
  minPrice: numeric("min_price", { precision: 12, scale: 2 }).notNull(),
  maxPrice: numeric("max_price", { precision: 12, scale: 2 }).notNull(),
  unit: text("unit").notNull(),
  minOrder: integer("min_order").notNull().default(1),
  imageUrl: text("image_url").notNull(),
  images: text("images").array(),
  inStock: boolean("in_stock").notNull().default(true),
  featured: boolean("featured").notNull().default(false),
  rating: numeric("rating", { precision: 3, scale: 2 }),
  reviewCount: integer("review_count").notNull().default(0),
  tags: text("tags").array(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true, reviewCount: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
