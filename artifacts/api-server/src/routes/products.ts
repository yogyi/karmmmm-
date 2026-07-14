import { Router, type IRouter } from "express";
import { eq, ilike, and, sql, gte, lte, desc, asc, inArray } from "drizzle-orm";
import { db, productsTable, suppliersTable, categoriesTable } from "@workspace/db";
import {
  CreateProductBody,
  UpdateProductBody,
  UpdateProductParams,
  GetProductParams,
  GetProductResponse,
  UpdateProductResponse,
  GetFeaturedProductsResponse,
  ListProductsQueryParams,
  DeleteProductParams,
} from "@workspace/api-zod";
import { requireClerkAuth } from "../lib/auth";

const router: IRouter = Router();

async function enrichProduct(product: typeof productsTable.$inferSelect) {
  const [supplier] = await db
    .select({
      companyName: suppliersTable.companyName,
      verified: suppliersTable.verified,
      location: suppliersTable.location,
    })
    .from(suppliersTable)
    .where(eq(suppliersTable.id, product.supplierId));
  const [category] = await db
    .select({ name: categoriesTable.name })
    .from(categoriesTable)
    .where(eq(categoriesTable.id, product.categoryId));

  return {
    ...product,
    minPrice: parseFloat(product.minPrice),
    maxPrice: parseFloat(product.maxPrice),
    rating: product.rating ? parseFloat(product.rating) : null,
    supplierName: supplier?.companyName ?? null,
    supplierVerified: supplier?.verified ?? null,
    supplierLocation: supplier?.location ?? null,
    categoryName: category?.name ?? null,
    images: product.images ?? [],
    tags: product.tags ?? [],
    createdAt: product.createdAt.toISOString(),
  };
}

router.get("/products", async (req, res): Promise<void> => {
  const parsed = ListProductsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { search, categoryId, supplierId, minPrice, maxPrice, page = 1, limit = 20 } = parsed.data;

  // Extra IndiaMART/Alibaba-style filters (not in OpenAPI yet)
  const inStock = req.query.inStock === "true" ? true : req.query.inStock === "false" ? false : null;
  const verifiedOnly = req.query.verifiedOnly === "true";
  const minRating = req.query.minRating != null ? Number(req.query.minRating) : null;
  const maxMoq = req.query.maxMoq != null ? Number(req.query.maxMoq) : null;
  const sort = typeof req.query.sort === "string" ? req.query.sort : "newest";

  const conditions = [];
  if (search) conditions.push(ilike(productsTable.name, `%${search}%`));
  if (categoryId != null) conditions.push(eq(productsTable.categoryId, categoryId));
  if (supplierId != null) conditions.push(eq(productsTable.supplierId, supplierId));
  if (minPrice != null) conditions.push(gte(productsTable.minPrice, String(minPrice)));
  if (maxPrice != null) conditions.push(lte(productsTable.maxPrice, String(maxPrice)));
  if (inStock != null) conditions.push(eq(productsTable.inStock, inStock));
  if (maxMoq != null && !Number.isNaN(maxMoq)) conditions.push(lte(productsTable.minOrder, maxMoq));
  if (minRating != null && !Number.isNaN(minRating)) {
    conditions.push(gte(productsTable.rating, String(minRating)));
  }

  if (verifiedOnly) {
    const verified = await db
      .select({ id: suppliersTable.id })
      .from(suppliersTable)
      .where(eq(suppliersTable.verified, true));
    const ids = verified.map((s) => s.id);
    if (ids.length === 0) {
      res.json({ items: [], total: 0, page, limit });
      return;
    }
    conditions.push(inArray(productsTable.supplierId, ids));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(productsTable)
    .where(whereClause);

  let orderBy = desc(productsTable.createdAt);
  if (sort === "price_asc") orderBy = asc(productsTable.minPrice);
  else if (sort === "price_desc") orderBy = desc(productsTable.minPrice);
  else if (sort === "rating") orderBy = desc(productsTable.rating);
  else if (sort === "moq") orderBy = asc(productsTable.minOrder);

  const items = await db
    .select()
    .from(productsTable)
    .where(whereClause)
    .orderBy(orderBy)
    .limit(limit)
    .offset((page - 1) * limit);

  const enriched = await Promise.all(items.map(enrichProduct));

  res.json({ items: enriched, total: count, page, limit });
});

router.get("/products/featured", async (_req, res): Promise<void> => {
  const items = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.featured, true))
    .limit(12);

  const enriched = await Promise.all(items.map(enrichProduct));
  res.json(GetFeaturedProductsResponse.parse(enriched));
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetProductParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, params.data.id));
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const enriched = await enrichProduct(product);
  res.json(GetProductResponse.parse(enriched));
});

router.post("/products", requireClerkAuth, async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [product] = await db.insert(productsTable).values({
    ...parsed.data,
    minPrice: String(parsed.data.minPrice),
    maxPrice: String(parsed.data.maxPrice),
    rating:
      "rating" in parsed.data && parsed.data.rating != null
        ? String((parsed.data as { rating?: number }).rating)
        : null,
  }).returning();

  const enriched = await enrichProduct(product);
  res.status(201).json(GetProductResponse.parse(enriched));
});

router.patch("/products/:id", requireClerkAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateProductParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.minPrice != null) data.minPrice = String(parsed.data.minPrice);
  if (parsed.data.maxPrice != null) data.maxPrice = String(parsed.data.maxPrice);
  const rating = (parsed.data as { rating?: number }).rating;
  if (rating != null) data.rating = String(rating);

  const [product] = await db
    .update(productsTable)
    .set(data)
    .where(eq(productsTable.id, params.data.id))
    .returning();

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const enriched = await enrichProduct(product);
  res.json(UpdateProductResponse.parse(enriched));
});

router.delete("/products/:id", requireClerkAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteProductParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [product] = await db
    .delete(productsTable)
    .where(eq(productsTable.id, params.data.id))
    .returning();

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.status(204).send();
});

export default router;
