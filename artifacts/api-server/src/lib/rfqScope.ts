import type { Prisma } from "@workspace/db";

/**
 * Seller RFQ inbox — opportunities only (never the viewer's own buyer RFQs):
 * - Directed / awarded RFQs for this shop
 * - Open marketplace RFQs still collecting quotes (pending | responded)
 * - RFQs this shop already quoted on
 */
export function sellerInboxWhere(
  supplierId: number,
  status?: string | null,
  viewerUserId?: number | null,
): Prisma.RfqWhereInput {
  const openCollecting: Prisma.RfqWhereInput = status
    ? { supplierId: null, status }
    : { supplierId: null, status: { in: ["pending", "responded"] } };

  const opportunityOr: Prisma.RfqWhereInput = status
    ? {
        OR: [
          { supplierId, status },
          // Status-filtered open RFQs this shop quoted (not every open RFQ with that status)
          { supplierId: null, status, quotes: { some: { supplierId } } },
          { status, quotes: { some: { supplierId } } },
        ],
      }
    : {
        OR: [
          { supplierId },
          openCollecting,
          { quotes: { some: { supplierId } } },
        ],
      };

  if (viewerUserId != null && viewerUserId > 0) {
    return {
      AND: [{ NOT: { buyerId: viewerUserId } }, opportunityOr],
    };
  }
  return opportunityOr;
}

/**
 * Sellers without a linked shop — open marketplace RFQs only.
 * Never mix in the viewer's own buyer RFQs (those belong in buyer mode).
 */
export function sellerOpenMarketplaceWhere(
  status?: string | null,
): Prisma.RfqWhereInput {
  const openStatuses = ["pending", "responded"] as const;
  if (status != null && status !== "pending" && status !== "responded") {
    // Closed RFQs are not opportunities for shop-less sellers
    return { id: { in: [] } };
  }
  return {
    supplierId: null,
    status: status ?? { in: [...openStatuses] },
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
