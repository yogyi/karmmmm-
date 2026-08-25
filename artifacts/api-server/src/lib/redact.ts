import type { DbUser } from "./authorize";
import { isAdmin, isRfqSupplierParty, parseLinkedSupplierId } from "./authorize";

type QuoteLike = {
  supplierId: number;
  unitPrice?: number;
  message?: string | null;
  status?: string;
};

type RfqLike = {
  buyerId: number | null;
  supplierId: number | null;
  buyerEmail: string;
  buyerName: string;
  quotedPrice?: unknown;
  sellerMessage?: string | null;
  targetPrice?: unknown;
  description?: string | null;
  status?: string;
  quotes?: QuoteLike[];
};

/**
 * Redact PII / commercial fields the viewer is not allowed to see.
 * - Buyer sees all quotes (to compare).
 * - Seller sees own quote fully; other sellers' prices hidden on open RFQs.
 * - Assigned/awarded supplier + admin see full detail.
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
      quotes: [],
    };
  }

  const isBuyer = rfq.buyerId != null && rfq.buyerId === viewer.id;
  const isSupplier = isRfqSupplierParty(viewer, rfq.supplierId);
  const linked = parseLinkedSupplierId(viewer);
  const canSeeOpenInquiry =
    rfq.supplierId == null &&
    (rfq.status === "pending" || rfq.status === "responded" || rfq.status == null) &&
    (viewer.role === "seller" || viewer.role === "admin");
  const admin = isAdmin(viewer);
  const quotedByViewer =
    linked != null && (rfq.quotes?.some((q) => q.supplierId === linked) ?? false);

  if (admin || isBuyer || isSupplier) {
    return rfq;
  }

  if (canSeeOpenInquiry || quotedByViewer) {
    // Sellers only see their own quote commercially — not competitors' prices.
    const quotes = (rfq.quotes ?? []).filter(
      (q) => linked != null && q.supplierId === linked,
    );
    const mine = quotes[0];
    return {
      ...rfq,
      quotes,
      quotedPrice: mine?.unitPrice ?? null,
      sellerMessage: mine?.message ?? null,
    };
  }

  return {
    ...rfq,
    buyerEmail: "",
    buyerName: "Buyer",
    quotedPrice: null,
    sellerMessage: null,
    description: null,
    quotes: [],
  };
}
