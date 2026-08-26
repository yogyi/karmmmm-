import { Router, type IRouter } from "express";
import { prisma, type Prisma } from "@workspace/db";
import {
  CreateReviewBody,
  ListReviewsQueryParams,
  ListReviewsResponse,
} from "@workspace/api-zod";
import { requireClerkAuth } from "../lib/auth";
import { getAuthenticatedDbUser } from "../lib/authorize";

const router: IRouter = Router();

async function refreshProductRating(productId: number) {
  const allReviews = await prisma.review.findMany({
    where: { productId },
    select: { rating: true },
  });
  if (allReviews.length === 0) {
    await prisma.product.update({
      where: { id: productId },
      data: { rating: null, reviewCount: 0 },
    });
    return;
  }
  const avg = allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length;
  await prisma.product.update({
    where: { id: productId },
    data: { rating: avg.toFixed(2), reviewCount: allReviews.length },
  });
}

async function refreshSupplierRating(supplierId: number) {
  const allReviews = await prisma.review.findMany({
    where: { supplierId },
    select: { rating: true },
  });
  if (allReviews.length === 0) {
    await prisma.supplier.update({
      where: { id: supplierId },
      data: { rating: 0, reviewCount: 0 },
    });
    return;
  }
  const avg = allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length;
  await prisma.supplier.update({
    where: { id: supplierId },
    data: { rating: avg.toFixed(2), reviewCount: allReviews.length },
  });
}

router.get("/reviews", async (req, res): Promise<void> => {
  const parsed = ListReviewsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { supplierId, productId } = parsed.data;

  const where: Prisma.ReviewWhereInput = {};
  if (supplierId != null) where.supplierId = supplierId;
  if (productId != null) where.productId = productId;

  const items = await prisma.review.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  res.json(
    ListReviewsResponse.parse(
      items.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    ),
  );
});

router.post("/reviews", requireClerkAuth, async (req, res): Promise<void> => {
  const parsed = CreateReviewBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const dbUser = await getAuthenticatedDbUser(req);
  if (!dbUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const { productId, supplierId, rating, comment, reviewerName } = parsed.data;

  if (productId == null && supplierId == null) {
    res.status(400).json({ error: "productId or supplierId is required" });
    return;
  }

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    res.status(400).json({ error: "Rating must be an integer from 1 to 5" });
    return;
  }

  if (productId != null) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, supplierId: true },
    });
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    const existing = await prisma.review.findFirst({
      where: { productId, reviewerId: dbUser.id },
      select: { id: true },
    });
    if (existing) {
      res.status(409).json({ error: "You already reviewed this product" });
      return;
    }

    const resolvedSupplierId = supplierId ?? product.supplierId;

    const review = await prisma.review.create({
      data: {
        productId,
        supplierId: resolvedSupplierId,
        rating,
        comment: comment.trim() || "No comment provided",
        reviewerId: dbUser.id,
        reviewerName: (dbUser.name || reviewerName || "Buyer").trim(),
      },
    });

    await refreshProductRating(productId);
    await refreshSupplierRating(resolvedSupplierId);

    res.status(201).json({ ...review, createdAt: review.createdAt.toISOString() });
    return;
  }

  // Supplier-only review
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId! },
    select: { id: true },
  });
  if (!supplier) {
    res.status(404).json({ error: "Supplier not found" });
    return;
  }

  const review = await prisma.review.create({
    data: {
      productId: null,
      supplierId: supplier.id,
      rating,
      comment: comment.trim() || "No comment provided",
      reviewerId: dbUser.id,
      reviewerName: (dbUser.name || reviewerName || "Buyer").trim(),
    },
  });

  await refreshSupplierRating(supplier.id);

  res.status(201).json({ ...review, createdAt: review.createdAt.toISOString() });
});

export default router;
