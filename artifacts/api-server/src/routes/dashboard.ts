import { Router, type IRouter } from "express";
import { prisma, toNumber, type Prisma } from "@workspace/db";
import {
  GetDashboardStatsResponse,
  GetSupplierDashboardParams,
  GetSupplierDashboardResponse,
} from "@workspace/api-zod";
import { requireClerkAuth } from "../lib/auth";
import {
  canAccessSupplier,
  getAuthenticatedDbUser,
  isAdmin,
  parseLinkedSupplierId,
} from "../lib/authorize";
import { redactRfqForViewer } from "../lib/redact";

const router: IRouter = Router();

function mapRfqRow(r: {
  id: number;
  productId: number | null;
  productName: string;
  supplierId: number | null;
  supplierName: string | null;
  buyerId: number | null;
  buyerName: string;
  buyerEmail: string;
  quantity: number;
  unit: string;
  targetPrice: { toString(): string } | string | number | null;
  description: string | null;
  status: string;
  createdAt: Date;
}) {
  return {
    ...r,
    targetPrice: toNumber(r.targetPrice),
    createdAt: r.createdAt.toISOString(),
  };
}

/**
 * Platform stats for signed-in users.
 * Recent RFQs are scoped to the viewer; emails redacted unless party/admin.
 */
router.get("/dashboard/stats", requireClerkAuth, async (req, res): Promise<void> => {
  const dbUser = await getAuthenticatedDbUser(req);

  const [totalProducts, totalSuppliers, totalRfqs, totalUsers, categories] =
    await Promise.all([
      prisma.product.count(),
      prisma.supplier.count(),
      prisma.rfq.count(),
      prisma.user.count(),
      prisma.category.findMany({
        select: { name: true, productCount: true },
        orderBy: { productCount: "asc" },
      }),
    ]);

  let recentRfqs: ReturnType<typeof mapRfqRow>[] = [];

  if (dbUser) {
    const where: Prisma.RfqWhereInput = isAdmin(dbUser)
      ? {}
      : {
          OR: [
            { buyerId: dbUser.id },
            ...(parseLinkedSupplierId(dbUser) != null
              ? [{ supplierId: parseLinkedSupplierId(dbUser)! }]
              : []),
          ],
        };

    const rows = await prisma.rfq.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    recentRfqs = rows
      .map(mapRfqRow)
      .map((r) => redactRfqForViewer(r, dbUser));
  }

  const stats = {
    totalProducts,
    totalSuppliers,
    totalRfqs,
    totalUsers,
    categoryBreakdown: categories.map((c) => ({
      categoryName: c.name,
      count: c.productCount,
    })),
    recentRfqs,
  };

  res.json(GetDashboardStatsResponse.parse(stats));
});

router.get("/dashboard/supplier/:id", requireClerkAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetSupplierDashboardParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const dbUser = await getAuthenticatedDbUser(req);
  if (!dbUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (!canAccessSupplier(dbUser, params.data.id)) {
    res.status(403).json({
      error: "Forbidden — this supplier dashboard is not linked to your account",
    });
    return;
  }

  const supplier = await prisma.supplier.findUnique({ where: { id: params.data.id } });
  if (!supplier) {
    res.status(404).json({ error: "Supplier not found" });
    return;
  }

  const [productCount, rfqCount, pendingRfqs, recentRfqs] = await Promise.all([
    prisma.product.count({ where: { supplierId: params.data.id } }),
    prisma.rfq.count({ where: { supplierId: params.data.id } }),
    prisma.rfq.count({
      where: { supplierId: params.data.id, status: "pending" },
    }),
    prisma.rfq.findMany({
      where: { supplierId: params.data.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  res.json(
    GetSupplierDashboardResponse.parse({
      supplier: {
        ...supplier,
        rating: toNumber(supplier.rating) ?? 0,
        responseRate: toNumber(supplier.responseRate),
        mainProducts: supplier.mainProducts ?? [],
        certifications: supplier.certifications ?? [],
      },
      productCount,
      rfqCount,
      pendingRfqs,
      recentRfqs: recentRfqs
        .map(mapRfqRow)
        .map((r) => redactRfqForViewer(r, dbUser)),
      // No view analytics yet — keep schema field as 0 rather than inventing numbers.
      totalViews: 0,
    }),
  );
});

export default router;
