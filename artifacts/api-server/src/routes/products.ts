import { Router, type IRouter } from "express";
import { prisma, toNumber, type Prisma } from "@workspace/db";
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
import { canAccessSupplier, getAuthenticatedDbUser, isAdmin, isSellerOrAdmin } from "../lib/authorize";
import { findOrCreateCategory, readCustomCategory } from "../lib/categories";
import { hasGstApiVerifiedBadge, GST_API_VERIFIED_WHERE } from "../lib/supplierDto";

const router: IRouter = Router();

type ProductRow = Prisma.ProductGetPayload<object>;

async function enrichProduct(product: ProductRow) {
  const [supplier, category] = await Promise.all([
    prisma.supplier.findUnique({
      where: { id: product.supplierId },
      select: {
        companyName: true,
        verified: true,
        gstVerified: true,
        gstLiveVerifiedAt: true,
        gstCertificateOcrVerifiedAt: true,
        location: true,
      },
    }),
    prisma.category.findUnique({
      where: { id: product.categoryId },
      select: { name: true },
    }),
  ]);

  return {
    ...product,
    minPrice: toNumber(product.minPrice) ?? 0,
    maxPrice: toNumber(product.maxPrice) ?? 0,
    rating: toNumber(product.rating),
    supplierName: supplier?.companyName ?? null,
    supplierVerified: supplier ? hasGstApiVerifiedBadge(supplier) : null,
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

  const inStock = req.query.inStock === "true" ? true : req.query.inStock === "false" ? false : null;
  const verifiedOnly = req.query.verifiedOnly === "true";
  const minRating = req.query.minRating != null ? Number(req.query.minRating) : null;
  const maxMoq = req.query.maxMoq != null ? Number(req.query.maxMoq) : null;
  const sort = typeof req.query.sort === "string" ? req.query.sort : "newest";

  const where: Prisma.ProductWhereInput = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }
  if (categoryId != null) where.categoryId = categoryId;
  if (supplierId != null) where.supplierId = supplierId;
  if (minPrice != null || maxPrice != null) {
    where.minPrice = {
      ...(minPrice != null ? { gte: minPrice } : {}),
      ...(maxPrice != null ? { lte: maxPrice } : {}),
    };
  }
  if (inStock != null) where.inStock = inStock;
  if (maxMoq != null && !Number.isNaN(maxMoq)) where.minOrder = { lte: maxMoq };
  if (minRating != null && !Number.isNaN(minRating)) where.rating = { gte: minRating };

  if (verifiedOnly) {
    const verified = await prisma.supplier.findMany({
      where: GST_API_VERIFIED_WHERE,
      select: { id: true },
    });
    const ids = verified.map((s) => s.id);
    if (ids.length === 0) {
      res.json({ items: [], total: 0, page, limit });
      return;
    }
    if (supplierId != null) {
      // Keep supplier filter AND verified constraint
      if (!ids.includes(supplierId)) {
        res.json({ items: [], total: 0, page, limit });
        return;
      }
      where.supplierId = supplierId;
    } else {
      where.supplierId = { in: ids };
    }
  }

  let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: "desc" };
  if (sort === "price_asc") orderBy = { minPrice: "asc" };
  else if (sort === "price_desc") orderBy = { minPrice: "desc" };
  else if (sort === "rating") orderBy = { rating: "desc" };
  else if (sort === "moq") orderBy = { minOrder: "asc" };

  const [total, items] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy,
      take: limit,
      skip: (page - 1) * limit,
    }),
  ]);

  const enriched = await Promise.all(items.map(enrichProduct));
  res.json({ items: enriched, total, page, limit });
});

router.get("/products/featured", async (_req, res): Promise<void> => {
  const items = await prisma.product.findMany({
    where: { featured: true },
    take: 12,
  });

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

  const product = await prisma.product.findUnique({ where: { id: params.data.id } });
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const enriched = await enrichProduct(product);
  res.json(GetProductResponse.parse(enriched));
});

router.post("/products", requireClerkAuth, async (req, res): Promise<void> => {
  const body = { ...(req.body as Record<string, unknown>) };
  const customCategory = readCustomCategory(body);
  delete body.customCategory;
  if (customCategory) {
    try {
      const category = await findOrCreateCategory(customCategory);
      body.categoryId = category.id;
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Invalid custom category",
      });
      return;
    }
  } else if (body.categoryId === -1) {
    res.status(400).json({ error: "Please enter a custom category" });
    return;
  }
  if (typeof body.imageUrl !== "string") {
    body.imageUrl = "";
  }

  const imageUrls = [
    typeof body.imageUrl === "string" ? body.imageUrl : "",
    ...(Array.isArray(body.images) ? body.images.filter((u): u is string => typeof u === "string") : []),
  ];
  if (imageUrls.some((u) => u.startsWith("data:"))) {
    res.status(400).json({
      error:
        "Inline image data is not allowed. Upload images via storage first, then save the product.",
    });
    return;
  }

  const parsed = CreateProductBody.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const dbUser = await getAuthenticatedDbUser(req);
  if (!dbUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (!isSellerOrAdmin(dbUser)) {
    res.status(403).json({ error: "Forbidden — only sellers can manage products" });
    return;
  }
  if (!canAccessSupplier(dbUser, parsed.data.supplierId)) {
    res.status(403).json({
      error: "Forbidden — you can only create products for your linked supplier",
    });
    return;
  }

  const { getSupplierEntitlements } = await import("../lib/shop");
  const entitlements = await getSupplierEntitlements(parsed.data.supplierId);
  const productCount = await prisma.product.count({
    where: { supplierId: parsed.data.supplierId },
  });
  if (productCount >= entitlements.maxProducts) {
    res.status(402).json({
      error: `Your ${entitlements.planCode} plan allows ${entitlements.maxProducts} products. Upgrade your shop plan to list more.`,
      planCode: entitlements.planCode,
      maxProducts: entitlements.maxProducts,
      productCount,
    });
    return;
  }

  // Only admins may feature products
  const createData = { ...parsed.data };
  if (createData.featured && !isAdmin(dbUser)) {
    delete createData.featured;
  }

  const rating =
    "rating" in parsed.data && parsed.data.rating != null
      ? (parsed.data as { rating?: number }).rating
      : null;

  const product = await prisma.product.create({
    data: {
      ...createData,
      images: parsed.data.images ?? [],
      tags: parsed.data.tags ?? [],
      rating: rating ?? undefined,
    },
  });

  await Promise.all([
    prisma.category.update({
      where: { id: product.categoryId },
      data: { productCount: { increment: 1 } },
    }),
    prisma.supplier.update({
      where: { id: product.supplierId },
      data: { productCount: { increment: 1 } },
    }),
  ]);

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

  const updateBody = { ...(req.body as Record<string, unknown>) };
  const customCategory = readCustomCategory(updateBody);
  delete updateBody.customCategory;
  let resolvedCategoryId: number | undefined;
  if (customCategory) {
    try {
      const category = await findOrCreateCategory(customCategory);
      resolvedCategoryId = category.id;
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Invalid custom category",
      });
      return;
    }
  } else if (typeof updateBody.categoryId === "number" && updateBody.categoryId > 0) {
    resolvedCategoryId = updateBody.categoryId;
  }
  delete updateBody.categoryId;

  const parsed = UpdateProductBody.safeParse(updateBody);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const dbUser = await getAuthenticatedDbUser(req);
  if (!dbUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const existing = await prisma.product.findUnique({ where: { id: params.data.id } });
  if (!existing) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  if (!canAccessSupplier(dbUser, existing.supplierId)) {
    res.status(403).json({ error: "Forbidden — you cannot edit this product" });
    return;
  }
  if (!isSellerOrAdmin(dbUser)) {
    res.status(403).json({ error: "Forbidden — only sellers can manage products" });
    return;
  }

  const data: Prisma.ProductUpdateInput = { ...parsed.data };
  if (resolvedCategoryId != null) {
    data.category = { connect: { id: resolvedCategoryId } };
  }
  if (typeof updateBody.name === "string" && updateBody.name.trim()) {
    data.name = updateBody.name.trim();
  }
  if (typeof updateBody.description === "string") {
    data.description = updateBody.description.trim() || null;
  }
  if (typeof updateBody.minPrice === "number") data.minPrice = updateBody.minPrice;
  if (typeof updateBody.maxPrice === "number") data.maxPrice = updateBody.maxPrice;
  if (typeof updateBody.unit === "string" && updateBody.unit.trim()) {
    data.unit = updateBody.unit.trim();
  }
  if (typeof updateBody.minOrder === "number") data.minOrder = updateBody.minOrder;
  if (typeof updateBody.imageUrl === "string") data.imageUrl = updateBody.imageUrl;
  if (Array.isArray(updateBody.images)) {
    data.images = updateBody.images.filter((x): x is string => typeof x === "string");
  }
  if (Array.isArray(updateBody.tags)) {
    data.tags = updateBody.tags.filter((x): x is string => typeof x === "string");
  }
  if (typeof updateBody.inStock === "boolean") data.inStock = updateBody.inStock;
  if ("featured" in data && data.featured != null && !isAdmin(dbUser)) {
    delete data.featured;
  }
  const rating = (parsed.data as { rating?: number }).rating;
  if (rating != null) data.rating = rating;

  const product = await prisma.product.update({
    where: { id: params.data.id },
    data,
  });
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

  const dbUser = await getAuthenticatedDbUser(req);
  if (!dbUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (!isSellerOrAdmin(dbUser)) {
    res.status(403).json({ error: "Forbidden — only sellers can manage products" });
    return;
  }

  const existing = await prisma.product.findUnique({ where: { id: params.data.id } });
  if (!existing) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  if (!canAccessSupplier(dbUser, existing.supplierId)) {
    res.status(403).json({ error: "Forbidden — you cannot delete this product" });
    return;
  }

  try {
    await prisma.$transaction([
      prisma.product.delete({ where: { id: params.data.id } }),
      prisma.category.update({
        where: { id: existing.categoryId },
        data: { productCount: { decrement: 1 } },
      }),
      prisma.supplier.update({
        where: { id: existing.supplierId },
        data: { productCount: { decrement: 1 } },
      }),
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed";
    res.status(409).json({
      error: message.includes("Foreign key") || message.includes("constraint")
        ? "This product is linked to other records and could not be deleted."
        : "Could not delete product. Please try again.",
    });
    return;
  }
  res.status(204).send();
});

export default router;
