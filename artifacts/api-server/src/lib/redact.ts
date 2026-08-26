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

function stripBuyerPii<T extends RfqLike>(rfq: T): T {
  return {
    ...rfq,
    buyerEmail: "",
    buyerName: "Buyer",
    targetPrice: null,
    description: null,
  };
}

/**
 * Redact PII / commercial fields the viewer is not allowed to see.
 *
 * Buyer contact (email/name/budget/description) is only shown to:
 * - the buyer themself
 * - admin
 * - the assigned/winning supplier (supplierId match)
 * - a seller whose quote is pending_confirm or awarded on this RFQ
 *
 * Open marketplace browsing and losing quoters after another win do NOT get buyer PII.
 */
export function redactRfqForViewer<T extends RfqLike>(rfq: T, viewer: DbUser | null): T {
  if (!viewer) {
    return {
      ...stripBuyerPii(rfq),
      quotedPrice: null,
      sellerMessage: null,
      quotes: [],
    };
  }

  const isBuyer = rfq.buyerId != null && rfq.buyerId === viewer.id;
  const isSupplier = isRfqSupplierParty(viewer, rfq.supplierId);
  const linked = parseLinkedSupplierId(viewer);
  const admin = isAdmin(viewer);
  const myQuote =
    linked != null ? (rfq.quotes ?? []).find((q) => q.supplierId === linked) : undefined;
  const isWinningOrPendingSeller =
    !!myQuote && (myQuote.status === "awarded" || myQuote.status === "pending_confirm");
  const isOpenCollecting =
    rfq.supplierId == null &&
    (rfq.status === "pending" || rfq.status === "responded" || rfq.status == null);
  const canBrowseOpen = isOpenCollecting && (viewer.role === "seller" || viewer.role === "admin");

  if (admin || isBuyer) {
    return rfq;
  }

  // Assigned / winning supplier (after confirm) or seller currently in handshake.
  if (isSupplier || isWinningOrPendingSeller) {
    const quotes = (rfq.quotes ?? []).filter(
      (q) => linked != null && q.supplierId === linked,
    );
    return {
      ...rfq,
      quotes,
    };
  }

  // Open marketplace browse or prior quote that lost — commercial glimpse only, no buyer PII.
  if (canBrowseOpen || myQuote) {
    const quotes = (rfq.quotes ?? []).filter(
      (q) => linked != null && q.supplierId === linked,
    );
    const mine = quotes[0];
    return {
      ...stripBuyerPii(rfq),
      quotes,
      quotedPrice: mine?.unitPrice ?? null,
      sellerMessage: mine?.message ?? null,
      // Hide internal buyer id from non-parties.
      buyerId: null,
    };
  }

  return {
    ...stripBuyerPii(rfq),
    quotedPrice: null,
    sellerMessage: null,
    buyerId: null,
    quotes: [],
  };
}
