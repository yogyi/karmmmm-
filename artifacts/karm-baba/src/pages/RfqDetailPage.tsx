import { useState } from "react";
import { useLocation } from "wouter";
import {
  ChevronLeft,
  Clock,
  CheckCircle,
  XCircle,
  MessageSquare,
  Send,
  Package,
  IndianRupee,
} from "lucide-react";
import {
  useGetRfq,
  useUpdateRfq,
  getListRfqsQueryKey,
  getGetRfqQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";

const statusConfig = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: <Clock size={12} /> },
  responded: { label: "Quoted", color: "bg-blue-100 text-blue-700 border-blue-200", icon: <MessageSquare size={12} /> },
  accepted: { label: "Accepted", color: "bg-green-100 text-green-700 border-green-200", icon: <CheckCircle size={12} /> },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-600 border-red-200", icon: <XCircle size={12} /> },
};

function httpStatus(err: unknown): number | null {
  if (!err || typeof err !== "object") return null;
  const e = err as { status?: number; response?: { status?: number } };
  return e.status ?? e.response?.status ?? null;
}

export function RfqDetailPage({ params }: { params: { id: string } }) {
  const [, navigate] = useLocation();
  const { user, isLoggedIn } = useAuth();
  const qc = useQueryClient();
  const rfqId = Number(params.id);

  const { data: rfq, isLoading, isError, error: loadError } = useGetRfq(rfqId, {
    query: {
      enabled: !!rfqId,
      retry: (failureCount: number, err: unknown) =>
        httpStatus(err) !== 401 && failureCount < 1,
    } as any,
  });
  const updateRfq = useUpdateRfq();

  const [quotePrice, setQuotePrice] = useState("");
  const [quoteMessage, setQuoteMessage] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const linkedShop =
    !!user && user.role === "seller" && typeof user.supplierId === "number";

  // Assigned shop, open marketplace RFQ (claim on quote), or admin.
  const canSendQuote =
    !!user &&
    !!rfq &&
    rfq.status === "pending" &&
    (user.role === "admin" ||
      (linkedShop &&
        (rfq.supplierId == null || rfq.supplierId === user.supplierId)));

  const isOpenRfq = !!rfq && rfq.supplierId == null;
  const isBuyer = !!user && user.id === rfq?.buyerId;

  async function submitQuote(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!quotePrice) {
      setError("Enter your quoted price per unit.");
      return;
    }
    try {
      await updateRfq.mutateAsync({
        id: rfqId,
        data: {
          status: "responded",
          quotedPrice: Number(quotePrice),
          sellerMessage: quoteMessage || undefined,
        } as { status: "responded"; quotedPrice: number; sellerMessage?: string },
      });
      qc.invalidateQueries({ queryKey: getGetRfqQueryKey(rfqId) });
      qc.invalidateQueries({ queryKey: getListRfqsQueryKey() });
      setSuccess("Quote sent to the buyer.");
      setQuotePrice("");
      setQuoteMessage("");
    } catch {
      setError("Failed to send quote. Please try again.");
    }
  }

  async function setStatus(status: "accepted" | "rejected") {
    if (status === "rejected") {
      const ok = window.confirm(
        "Reject this quote? You can still post a new RFQ later if needed.",
      );
      if (!ok) return;
    }
    setError("");
    try {
      await updateRfq.mutateAsync({ id: rfqId, data: { status } });
      qc.invalidateQueries({ queryKey: getGetRfqQueryKey(rfqId) });
      qc.invalidateQueries({ queryKey: getListRfqsQueryKey() });
      setSuccess(status === "accepted" ? "Quote accepted." : "Quote rejected.");
    } catch {
      setError("Could not update status.");
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 animate-pulse space-y-4">
        <div className="h-6 bg-muted rounded-full w-40" />
        <div className="h-40 bg-muted rounded-2xl" />
      </div>
    );
  }

  if (isError && httpStatus(loadError) === 401) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <Package className="mx-auto mb-3 text-muted-foreground" />
        <h2 className="font-heading font-bold text-xl mb-2">Sign in to view this RFQ</h2>
        <p className="text-sm text-muted-foreground mb-4">
          This request is private. Sign in with the buyer or seller account that owns it.
        </p>
        <button
          type="button"
          onClick={() =>
            navigate(`/login?redirect=${encodeURIComponent(`/rfq/${rfqId}`)}`)
          }
          className="w-full max-w-xs mx-auto min-h-11 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-semibold"
        >
          Sign in →
        </button>
      </div>
    );
  }

  if (!rfq) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <Package className="mx-auto mb-3 text-muted-foreground" />
        <h2 className="font-heading font-bold text-xl mb-2">RFQ not found</h2>
        <button
          type="button"
          onClick={() => navigate("/rfq")}
          className="text-primary text-sm font-medium"
        >
          ← Back to My RFQs
        </button>
      </div>
    );
  }

  const status = statusConfig[rfq.status as keyof typeof statusConfig] ?? statusConfig.pending;
  const quotedPrice = (rfq as { quotedPrice?: number | null }).quotedPrice;
  const sellerMessage = (rfq as { sellerMessage?: string | null }).sellerMessage;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <button
        type="button"
        onClick={() => navigate("/rfq")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-6 font-medium"
      >
        <ChevronLeft size={16} /> Back to RFQs
      </button>

      <div className="bg-white rounded-2xl border border-border shadow-sm p-6 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">{rfq.productName}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              RFQ #{rfq.id} · {new Date(rfq.createdAt).toLocaleString("en-IN")}
            </p>
          </div>
          <span className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${status.color}`}>
            {status.icon} {status.label}
          </span>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div className="bg-muted/40 rounded-xl p-3">
            <div className="text-muted-foreground text-xs mb-1">Quantity</div>
            <div className="font-semibold">
              {rfq.quantity} {rfq.unit}
            </div>
          </div>
          <div className="bg-muted/40 rounded-xl p-3">
            <div className="text-muted-foreground text-xs mb-1">Target price</div>
            <div className="font-semibold">
              {rfq.targetPrice != null ? `₹${rfq.targetPrice}/${rfq.unit}` : "Not specified"}
            </div>
          </div>
          <div className="bg-muted/40 rounded-xl p-3">
            <div className="text-muted-foreground text-xs mb-1">Category</div>
            <div className="font-semibold">{rfq.categoryName ?? "Not specified"}</div>
          </div>
          <div className="bg-muted/40 rounded-xl p-3">
            <div className="text-muted-foreground text-xs mb-1">Buyer</div>
            <div className="font-semibold">{rfq.buyerName}</div>
            <div className="text-xs text-muted-foreground">{rfq.buyerEmail}</div>
          </div>
          <div className="bg-muted/40 rounded-xl p-3 sm:col-span-2">
            <div className="text-muted-foreground text-xs mb-1">Supplier</div>
            <div className="font-semibold">{rfq.supplierName ?? "Open RFQ"}</div>
          </div>
        </div>

        {rfq.description && (
          <div className="mt-4 text-sm">
            <div className="text-xs text-muted-foreground mb-1">Requirements</div>
            <p className="text-foreground whitespace-pre-wrap">{rfq.description}</p>
          </div>
        )}
      </div>

      {/* Quote card */}
      {(quotedPrice != null || sellerMessage) && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-2 text-blue-800 font-semibold">
            <IndianRupee size={16} /> Supplier Quote
          </div>
          {quotedPrice != null && (
            <div className="text-2xl font-heading font-bold text-blue-900 mb-1">
              ₹{quotedPrice}
              <span className="text-sm font-medium text-blue-700"> / {rfq.unit}</span>
            </div>
          )}
          {sellerMessage && <p className="text-sm text-blue-900/80 whitespace-pre-wrap">{sellerMessage}</p>}
        </div>
      )}

      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</div>}
      {success && <div className="mb-4 text-sm text-green-700 bg-green-50 border border-green-100 rounded-xl px-3 py-2">{success}</div>}

      {/* Seller quote form (assigned shop or claim open RFQ) */}
      {isLoggedIn && canSendQuote && (
        <form onSubmit={submitQuote} className="bg-white rounded-2xl border border-border p-6 shadow-sm space-y-4">
          <h2 className="font-heading font-bold text-lg">
            {isOpenRfq ? "Claim & send your best price" : "Send your best price"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isOpenRfq
              ? "This is an open marketplace inquiry. Sending a quote assigns it to your shop."
              : "Reply with a competitive wholesale quote for this buyer."}
          </p>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Quoted price (₹ / {rfq.unit})</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={quotePrice}
              onChange={(e) => setQuotePrice(e.target.value)}
              className="mt-1 w-full border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              placeholder="e.g. 185"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Message to buyer</label>
            <textarea
              value={quoteMessage}
              onChange={(e) => setQuoteMessage(e.target.value)}
              rows={3}
              className="mt-1 w-full border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              placeholder="MOQ notes, delivery timeline, payment terms..."
            />
          </div>
          <button
            type="submit"
            disabled={updateRfq.isPending}
            className="w-full inline-flex items-center justify-center gap-2 bg-primary text-white px-5 min-h-11 rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-60"
          >
            <Send size={14} /> Send Quote
          </button>
        </form>
      )}

      {/* Buyer accept/reject */}
      {isLoggedIn && isBuyer && rfq.status === "responded" && (
        <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
          <h2 className="font-heading font-bold text-lg mb-2">Respond to quote</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Accept to lock in this wholesale offer, or reject to keep negotiating.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              disabled={updateRfq.isPending}
              onClick={() => void setStatus("accepted")}
              className="flex-1 bg-green-600 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-green-700 disabled:opacity-60"
            >
              Accept Quote
            </button>
            <button
              type="button"
              disabled={updateRfq.isPending}
              onClick={() => void setStatus("rejected")}
              className="flex-1 border border-border py-2.5 rounded-xl font-semibold text-sm hover:bg-muted disabled:opacity-60"
            >
              Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
