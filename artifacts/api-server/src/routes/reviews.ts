import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, reviewsTable, suppliersTable, productsTable } from "@workspace/db";
import {
  CreateReviewBody,
  ListReviewsQueryParams,
  ListReviewsResponse,
} from "@workspace/api-zod";
import { sql } from "drizzle-orm";
import { requireClerkAuth } from "../lib/auth";

const router: IRouter = Router();

router.get("/reviews", async (req, res): Promise<void> => {
  const parsed = ListReviewsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { supplierId, productId } = parsed.data;

  const conditions = [];
  if (supplierId != null) conditions.push(eq(reviewsTable.supplierId, supplierId));
  if (productId != null) conditions.push(eq(reviewsTable.productId, productId));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const items = await db.select().from(reviewsTable).where(whereClause).orderBy(reviewsTable.createdAt);

  res.json(ListReviewsResponse.parse(items.map(r => ({ ...r, createdAt: r.createdAt.toISOString() }))));
});

router.post("/reviews", requireClerkAuth, async (req, res): Promise<void> => {
  const parsed = CreateReviewBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [review] = await db.insert(reviewsTable).values(parsed.data).returning();

  if (parsed.data.supplierId) {
    const allReviews = await db
      .select({ rating: reviewsTable.rating })
      .from(reviewsTable)
      .where(eq(reviewsTable.supplierId, parsed.data.supplierId));
    const avg = allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length;
    await db
      .update(suppliersTable)
      .set({ rating: String(avg.toFixed(2)), reviewCount: allReviews.length })
      .where(eq(suppliersTable.id, parsed.data.supplierId));
  }

  if (parsed.data.productId) {
    const allReviews = await db
      .select({ rating: reviewsTable.rating })
      .from(reviewsTable)
      .where(eq(reviewsTable.productId, parsed.data.productId));
    const avg = allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length;
    await db
      .update(productsTable)
      .set({ rating: String(avg.toFixed(2)), reviewCount: allReviews.length })
      .where(eq(productsTable.id, parsed.data.productId));
  }

  res.status(201).json({ ...review, createdAt: review.createdAt.toISOString() });
});

export default router;
