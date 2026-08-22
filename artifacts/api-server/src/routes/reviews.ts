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
    orderBy: { createdAt: "asc" },
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

  // Bind reviewer identity to the authenticated user — never trust client IDs/names alone.
  const review = await prisma.review.create({
    data: {
      ...parsed.data,
      reviewerId: dbUser.id,
      reviewerName: dbUser.name || parsed.data.reviewerName,
    },
  });

  if (parsed.data.supplierId) {
    const allReviews = await prisma.review.findMany({
      where: { supplierId: parsed.data.supplierId },
      select: { rating: true },
    });
    const avg = allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length;
    await prisma.supplier.update({
      where: { id: parsed.data.supplierId },
      data: { rating: avg.toFixed(2), reviewCount: allReviews.length },
    });
  }

  if (parsed.data.productId) {
    const allReviews = await prisma.review.findMany({
      where: { productId: parsed.data.productId },
      select: { rating: true },
    });
    const avg = allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length;
    await prisma.product.update({
      where: { id: parsed.data.productId },
      data: { rating: avg.toFixed(2), reviewCount: allReviews.length },
    });
  }

  res.status(201).json({ ...review, createdAt: review.createdAt.toISOString() });
});

export default router;
