import type { Prisma } from "@workspace/db";

/**
 * Seller RFQ inbox — opportunities + closed marketplace deals (visible as closed):
 * - Directed / awarded RFQs for this shop
 * - Open marketplace RFQs (collecting, awaiting confirm, or closed)
 * - RFQs this shop already quoted on
 * Never includes the viewer's own buyer RFQs.
 */
export function sellerInboxWhere(
  supplierId: number,
  status?: string | null,
  viewerUserId?: number | null,
): Prisma.RfqWhereInput {
  const marketplaceVisible: Prisma.RfqWhereInput = status
    ? { supplierId: null, status }
    : {
        supplierId: null,
        status: { in: ["pending", "responded", "pending_confirm", "accepted"] },
      };

  const opportunityOr: Prisma.RfqWhereInput = status
    ? {
        OR: [
          { supplierId, status },
          { supplierId: null, status, quotes: { some: { supplierId } } },
          { status, quotes: { some: { supplierId } } },
        ],
      }
    : {
        OR: [
          { supplierId },
          marketplaceVisible,
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
 * Sellers without a linked shop — open marketplace RFQs (incl. closed, as read-only).
 */
export function sellerOpenMarketplaceWhere(
  status?: string | null,
): Prisma.RfqWhereInput {
  const visible = ["pending", "responded", "pending_confirm", "accepted"] as const;
  if (status != null && !(visible as readonly string[]).includes(status)) {
    return { id: { in: [] } };
  }
  return {
    supplierId: null,
    status: status ?? { in: [...visible] },
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
