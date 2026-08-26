import { Router, type IRouter } from "express";
import { prisma } from "@workspace/db";
import { ListCategoriesResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/categories", async (_req, res): Promise<void> => {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });

  const payload = categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    icon: c.icon,
    imageUrl: c.imageUrl,
    description: c.description,
    // Live count from products table — not the possibly-stale denormalized field
    productCount: c._count.products,
  }));

  // Heal stale counters in the background (non-blocking)
  const stale = categories.filter((c) => c.productCount !== c._count.products);
  if (stale.length > 0) {
    void Promise.all(
      stale.map((c) =>
        prisma.category.update({
          where: { id: c.id },
          data: { productCount: c._count.products },
        }),
      ),
    ).catch(() => undefined);
  }

  res.json(ListCategoriesResponse.parse(payload));
});

export default router;
