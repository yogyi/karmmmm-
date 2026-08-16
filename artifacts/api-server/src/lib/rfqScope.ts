import type { Prisma } from "@workspace/db";

/**
 * Seller RFQ inbox: RFQs assigned to this shop plus open marketplace inquiries.
 * Keep dashboard "Recent RFQs" and GET /rfq?supplierId= in sync.
 */
export function sellerInboxWhere(
  supplierId: number,
  status?: string | null,
): Prisma.RfqWhereInput {
  if (status) {
    return {
      OR: [
        { supplierId, status },
        { supplierId: null, status },
      ],
    };
  }
  return {
    OR: [{ supplierId }, { supplierId: null, status: "pending" }],
  };
}
