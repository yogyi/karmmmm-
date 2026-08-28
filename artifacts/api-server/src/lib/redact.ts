import type { DbUser } from "./authorize";
import { isAdmin, isRfqSupplierParty, parseLinkedSupplierId } from "./authorize";
import { isRfqAwaitingSellerConfirm, isRfqClosed } from "./rfqDeal";

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

function stripBuyerContact<T extends RfqLike>(rfq: T): T {
  return {
    ...rfq,
    buyerEmail: "",
  };
}

/** Hide email + commercial notes; keep public buyer display name for marketplace quoting. */
function stripBuyerPrivateFields<T extends RfqLike>(rfq: T): T {
  return {
    ...stripBuyerContact(rfq),
    targetPrice: null,
    description: null,
  };
}

/**
 * Redact PII / commercial fields the viewer is not allowed to see.
 *
 * Buyer email, budget, and private notes are shown to:
 * - the buyer themself
 * - admin
 * - the assigned / winning supplier once a deal is closing or closed
 * - a seller whose quote is pending_confirm or awarded
 *
 * Buyer display name is visible to authenticated sellers on open marketplace RFQs.
 */
export function redactRfqForViewer<T extends RfqLike>(rfq: T, viewer: DbUser | null): T {
  if (!viewer) {
    return {
      ...stripBuyerPrivateFields(rfq),
      buyerName: "Buyer",
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
  const dealClosed = rfq.status != null && isRfqClosed(rfq.status);
  const awaitingConfirm =
    rfq.status != null && isRfqAwaitingSellerConfirm(rfq.status);
  const isOpenCollecting =
    rfq.supplierId == null &&
    (rfq.status === "pending" || rfq.status === "responded" || rfq.status == null);
  const canBrowseOpen = isOpenCollecting && (viewer.role === "seller" || viewer.role === "admin");

  const filterMyQuotes = () =>
    (rfq.quotes ?? []).filter((q) => linked != null && q.supplierId === linked);

  if (admin || isBuyer) {
    return rfq;
  }

  // Winning / assigned seller — full buyer contact (email, budget, notes) when deal is
  // closing or closed, or for directed RFQs assigned to their shop.
  const canSeeBuyerContact =
    isSupplier ||
    isWinningOrPendingSeller ||
    ((dealClosed || awaitingConfirm) &&
      linked != null &&
      (rfq.supplierId === linked || isWinningOrPendingSeller));

  if (canSeeBuyerContact) {
    return {
      ...rfq,
      quotes: filterMyQuotes(),
    };
  }

  // Open marketplace browse or prior quote that lost — name only, no email/budget.
  if (canBrowseOpen || myQuote) {
    const quotes = filterMyQuotes();
    const mine = quotes[0];
    const displayName =
      typeof rfq.buyerName === "string" && rfq.buyerName.trim()
        ? rfq.buyerName.trim()
        : "Buyer";
    return {
      ...stripBuyerPrivateFields(rfq),
      buyerName: displayName,
      quotes,
      quotedPrice: mine?.unitPrice ?? null,
      sellerMessage: mine?.message ?? null,
      buyerId: null,
    };
  }

  return {
    ...stripBuyerPrivateFields(rfq),
    buyerName: "Buyer",
    quotedPrice: null,
    sellerMessage: null,
    buyerId: null,
    quotes: [],
  };
}
