import type { DbUser } from "./authorize";
import { isAdmin, isRfqSupplierParty, parseLinkedSupplierId } from "./authorize";

type RfqLike = {
  buyerId: number | null;
  supplierId: number | null;
  buyerEmail: string;
  buyerName: string;
  quotedPrice?: unknown;
  sellerMessage?: string | null;
  targetPrice?: unknown;
  description?: string | null;
};

/**
 * Redact PII / commercial fields the viewer is not allowed to see.
 * - buyerEmail: buyer, assigned supplier, open-RFQ sellers, or admin only
 * - quotes / sellerMessage: same parties only (not random authenticated users)
 */
export function redactRfqForViewer<T extends RfqLike>(rfq: T, viewer: DbUser | null): T {
  if (!viewer) {
    return {
      ...rfq,
      buyerEmail: "",
      buyerName: "Buyer",
      quotedPrice: null,
      sellerMessage: null,
      targetPrice: null,
      description: null,
    };
  }

  const isBuyer = rfq.buyerId != null && rfq.buyerId === viewer.id;
  const isSupplier = isRfqSupplierParty(viewer, rfq.supplierId);
  const canSeeOpenInquiry =
    rfq.supplierId == null &&
    parseLinkedSupplierId(viewer) != null &&
    (viewer.role === "seller" || viewer.role === "admin");
  const admin = isAdmin(viewer);

  if (admin || isBuyer || isSupplier || canSeeOpenInquiry) {
    return rfq;
  }

  return {
    ...rfq,
    buyerEmail: "",
    buyerName: "Buyer",
    quotedPrice: null,
    sellerMessage: null,
    description: null,
  };
}
