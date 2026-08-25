import type { Prisma } from "@workspace/db";

/**
 * Seller RFQ inbox:
 * - Directed / awarded RFQs for this shop
 * - Open marketplace RFQs still collecting quotes (pending | responded)
 * - RFQs this shop already quoted on
 */
export function sellerInboxWhere(
  supplierId: number,
  status?: string | null,
): Prisma.RfqWhereInput {
  const openCollecting: Prisma.RfqWhereInput = {
    supplierId: null,
    status: status
      ? status
      : { in: ["pending", "responded"] },
  };

  const baseOr: Prisma.RfqWhereInput[] = [
    { supplierId },
    openCollecting,
    { quotes: { some: { supplierId } } },
  ];

  if (status) {
    return {
      OR: [
        { supplierId, status },
        { supplierId: null, status },
        { status, quotes: { some: { supplierId } } },
      ],
    };
  }

  return { OR: baseOr };
}

/** Sellers without a linked shop still see open marketplace RFQs (+ their own buyer RFQs). */
export function sellerOpenMarketplaceWhere(
  buyerUserId: number,
  status?: string | null,
): Prisma.RfqWhereInput {
  if (status) {
    return {
      OR: [
        { buyerId: buyerUserId, status },
        { supplierId: null, status },
      ],
    };
  }
  return {
    OR: [
      { buyerId: buyerUserId },
      { supplierId: null, status: { in: ["pending", "responded"] } },
    ],
  };
}

/** Highest target price first; null budgets last; then newest. */
export function sortRfqsForSellerInbox<
  T extends { targetPrice?: unknown; createdAt: Date | string },
>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const ap =
      a.targetPrice != null && a.targetPrice !== ""
        ? Number(a.targetPrice)
        : Number.NEGATIVE_INFINITY;
    const bp =
      b.targetPrice != null && b.targetPrice !== ""
        ? Number(b.targetPrice)
        : Number.NEGATIVE_INFINITY;
    const aOk = Number.isFinite(ap) ? ap : Number.NEGATIVE_INFINITY;
    const bOk = Number.isFinite(bp) ? bp : Number.NEGATIVE_INFINITY;
    if (bOk !== aOk) return bOk - aOk;
    const at = new Date(a.createdAt).getTime();
    const bt = new Date(b.createdAt).getTime();
    return bt - at;
  });
}
