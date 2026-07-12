import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, productsTable, suppliersTable, rfqTable, usersTable, categoriesTable } from "@workspace/db";
import { GetDashboardStatsResponse, GetSupplierDashboardParams, GetSupplierDashboardResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/stats", async (_req, res): Promise<void> => {
  const [{ totalProducts }] = await db.select({ totalProducts: sql<number>`count(*)::int` }).from(productsTable);
  const [{ totalSuppliers }] = await db.select({ totalSuppliers: sql<number>`count(*)::int` }).from(suppliersTable);
  const [{ totalRfqs }] = await db.select({ totalRfqs: sql<number>`count(*)::int` }).from(rfqTable);
  const [{ totalUsers }] = await db.select({ totalUsers: sql<number>`count(*)::int` }).from(usersTable);

  const categories = await db.select({ name: categoriesTable.name, count: categoriesTable.productCount }).from(categoriesTable).orderBy(categoriesTable.productCount);
  const categoryBreakdown = categories.map(c => ({ categoryName: c.name, count: c.count }));

  const recentRfqs = await db
    .select()
    .from(rfqTable)
    .orderBy(rfqTable.createdAt)
    .limit(5);

  const stats = {
    totalProducts,
    totalSuppliers,
    totalRfqs,
    totalUsers,
    categoryBreakdown,
    recentRfqs: recentRfqs.map(r => ({
      ...r,
      targetPrice: r.targetPrice ? parseFloat(r.targetPrice) : null,
      createdAt: r.createdAt.toISOString(),
    })),
  };

  res.json(GetDashboardStatsResponse.parse(stats));
});

router.get("/dashboard/supplier/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetSupplierDashboardParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [supplier] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, params.data.id));
  if (!supplier) {
    res.status(404).json({ error: "Supplier not found" });
    return;
  }

  const [{ productCount }] = await db
    .select({ productCount: sql<number>`count(*)::int` })
    .from(productsTable)
    .where(eq(productsTable.supplierId, params.data.id));

  const [{ rfqCount }] = await db
    .select({ rfqCount: sql<number>`count(*)::int` })
    .from(rfqTable)
    .where(eq(rfqTable.supplierId, params.data.id));

  const [{ pendingRfqs }] = await db
    .select({ pendingRfqs: sql<number>`count(*)::int` })
    .from(rfqTable)
    .where(eq(rfqTable.supplierId, params.data.id));

  const recentRfqs = await db
    .select()
    .from(rfqTable)
    .where(eq(rfqTable.supplierId, params.data.id))
    .orderBy(rfqTable.createdAt)
    .limit(5);

  res.json(GetSupplierDashboardResponse.parse({
    supplier: {
      ...supplier,
      rating: parseFloat(supplier.rating ?? "0"),
      responseRate: supplier.responseRate ? parseFloat(supplier.responseRate) : null,
      mainProducts: supplier.mainProducts ?? [],
      certifications: supplier.certifications ?? [],
    },
    productCount,
    rfqCount,
    pendingRfqs,
    recentRfqs: recentRfqs.map(r => ({
      ...r,
      targetPrice: r.targetPrice ? parseFloat(r.targetPrice) : null,
      createdAt: r.createdAt.toISOString(),
    })),
    totalViews: Math.floor(Math.random() * 5000) + 500,
  }));
});

export default router;
