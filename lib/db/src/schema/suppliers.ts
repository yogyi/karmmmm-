import { pgTable, serial, text, integer, boolean, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const suppliersTable = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull(),
  description: text("description"),
  location: text("location").notNull(),
  country: text("country"),
  logoUrl: text("logo_url"),
  coverUrl: text("cover_url"),
  verified: boolean("verified").notNull().default(false),
  yearsInBusiness: integer("years_in_business"),
  employeeCount: text("employee_count"),
  mainProducts: text("main_products").array(),
  certifications: text("certifications").array(),
  rating: numeric("rating", { precision: 3, scale: 2 }).notNull().default("0"),
  reviewCount: integer("review_count").notNull().default(0),
  productCount: integer("product_count").notNull().default(0),
  responseRate: numeric("response_rate", { precision: 5, scale: 2 }),
  responseTime: text("response_time"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSupplierSchema = createInsertSchema(suppliersTable).omit({ id: true, createdAt: true, reviewCount: true, productCount: true });
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type Supplier = typeof suppliersTable.$inferSelect;
