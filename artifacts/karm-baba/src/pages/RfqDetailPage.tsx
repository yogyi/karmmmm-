import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  ChevronLeft,
  Clock,
  CheckCircle,
  XCircle,
  MessageSquare,
  Send,
  Package,
  Trophy,
} from "lucide-react";
import {
  useGetRfq,
  useUpdateRfq,
  useSubmitRfqQuote,
  useAwardRfqQuote,
} from "@workspace/api-client-react";
import type { RfqQuote } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { invalidateRfqQueries } from "@/lib/rfqQueries";
import { useAppDialog } from "@/components/AppDialog";

const statusConfig = {
  pending: {
    label: "Open for quotes",
    color: "bg-yellow-100 text-yellow-700 border-yellow-200",
    icon: <Clock size={12} />,
  },
  responded: {
    label: "Quotes received",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    icon: <MessageSquare size={12} />,
  },
  accepted: {
    label: "Deal closed",
    color: "bg-green-100 text-green-700 border-green-200",
    icon: <CheckCircle size={12} />,
  },
  rejected: {
    label: "Cancelled",
    color: "bg-red-100 text-red-600 border-red-200",
    icon: <XCircle size={12} />,
  },
};

const CURRENCIES = [
  { code: "INR", symbol: "₹", label: "INR (₹)" },
  { code: "USD", symbol: "$", label: "USD ($)" },
  { code: "EUR", symbol: "€", label: "EUR (€)" },
] as const;

const UNITS = ["piece", "kg", "ton", "meter", "liter", "box", "set", "dozen", "pair", "roll"] as const;

const PAYMENT_TERMS = [
  "Negotiable",
  "100% advance",
  "30% advance, 70% before dispatch",
  "Against delivery (COD)",
  "Net 15",
  "Net 30",
  "LC at sight",
] as const;

type CurrencyCode = (typeof CURRENCIES)[number]["code"];

function httpStatus(err: unknown): number | null {
  if (!err || typeof err !== "object") return null;
  const e = err as { status?: number; response?: { status?: number }; message?: string };
  return e.status ?? e.response?.status ?? null;
}

function errMessage(err: unknown, fallback: string) {
  if (err && typeof err === "object" && "message" in err) {
    const m = String((err as { message?: string }).message || "");
    if (m && !m.startsWith("Failed") && m.length < 200) return m;
  }
  return fallback;
}

function currencySymbol(code: string) {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? "₹";
}

function formatMoney(amount: number, code: string) {
  const symbol = currencySymbol(code);
  return `${symbol}${amount.toLocaleString("en-IN", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function RfqDetailPage({ params }: { params: { id: string } }) {
  const [, navigate] = useLocation();
  const { user, isLoggedIn } = useAuth();
  const { confirm } = useAppDialog();
  const qc = useQueryClient();
  const rfqId = Number(params.id);

  const { data: rfq, isLoading, isError, error: loadError, refetch } = useGetRfq(rfqId, {
    query: {
      enabled: !!rfqId,
      refetchInterval: 8_000,
      staleTime: 0,
      retry: (failureCount: number, err: unknown) =>
        httpStatus(err) !== 401 && failureCount < 1,
    } as any,
  });
  const updateRfq = useUpdateRfq();
  const submitQuote = useSubmitRfqQuote();
  const awardQuote = useAwardRfqQuote();

  const [currency, setCurrency] = useState<CurrencyCode>("INR");
  const [quotePrice, setQuotePrice] = useState("");
  const [quoteQty, setQuoteQty] = useState("");
  const [quoteUnit, setQuoteUnit] = useState("piece");
  const [leadTimeDays, setLeadTimeDays] = useState("7");
  const [validDays, setValidDays] = useState("7");
  const [paymentTerms, setPaymentTerms] = useState<string>(PAYMENT_TERMS[0]);
  const [quoteMessage, setQuoteMessage] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [qtySeeded, setQtySeeded] = useState(false);

  useEffect(() => {
    if (!rfq || qtySeeded) return;
    setQuoteQty(String(rfq.quantity));
    setQuoteUnit(rfq.unit || "piece");
    if (rfq.targetPrice != null) setQuotePrice(String(rfq.targetPrice));
    setQtySeeded(true);
  }, [rfq, qtySeeded]);

  // Prefill form from seller's existing quote when updating
  useEffect(() => {
    if (!rfq || !user?.supplierId) return;
    const mine = (rfq.quotes ?? []).find((q) => q.supplierId === user.supplierId);
    if (!mine) return;
    setQuotePrice(String(mine.unitPrice));
    setQuoteQty(String(mine.quantity));
    setQuoteUnit(mine.unit || "piece");
    setCurrency((mine.currency as CurrencyCode) || "INR");
    if (mine.leadTimeDays != null) setLeadTimeDays(String(mine.leadTimeDays));
    if (mine.validDays != null) setValidDays(String(mine.validDays));
    if (mine.paymentTerms) setPaymentTerms(mine.paymentTerms);
    if (mine.message) setQuoteMessage(mine.message);
  }, [rfq?.id, user?.supplierId]); // eslint-disable-line react-hooks/exhaustive-deps

  const unitPriceNum = Number(quotePrice);
  const qtyNum = Number(quoteQty);
  const lineTotal = useMemo(() => {
    if (!Number.isFinite(unitPriceNum) || unitPriceNum < 0) return null;
    if (!Number.isFinite(qtyNum) || qtyNum < 1) return null;
    return unitPriceNum * qtyNum;
  }, [unitPriceNum, qtyNum]);

  const linkedShop =
    !!user && user.role === "seller" && typeof user.supplierId === "number" && user.supplierId > 0;

  const isOpenForQuotes = !!rfq && (rfq.status === "pending" || rfq.status === "responded");
  const isOwnBuyerRfq = !!user && !!rfq && user.id === rfq.buyerId;
  const canSendQuote =
    !!user &&
    !!rfq &&
    isOpenForQuotes &&
    !isOwnBuyerRfq &&
    (user.role === "admin" ||
      (linkedShop && (rfq.supplierId == null || rfq.supplierId === user.supplierId)));

  const myQuote = useMemo(() => {
    if (!rfq || !user?.supplierId || user.role !== "seller") return null;
    return (rfq.quotes ?? []).find((q) => q.supplierId === user.supplierId) ?? null;
  }, [rfq, user?.supplierId, user?.role]);

  // Buyer tools (award / cancel) only in buyer mode — not while acting as seller.
  const isBuyer =
    !!user &&
    !!rfq &&
    user.id === rfq.buyerId &&
    user.role !== "seller";
  const quotes = (rfq?.quotes ?? []) as RfqQuote[];
  const activeQuotes = quotes.filter((q) => q.status === "active" || q.status === "awarded");
  const dealClosed = rfq?.status === "accepted" || rfq?.status === "rejected";

  async function onSubmitQuote(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!Number.isFinite(unitPriceNum) || unitPriceNum <= 0) {
      setError("Enter a valid unit price.");
      return;
    }
    if (!Number.isFinite(qtyNum) || qtyNum < 1) {
      setError("Enter a valid offer quantity (at least 1).");
      return;
    }
    try {
      await submitQuote.mutateAsync({
        id: rfqId,
        data: {
          unitPrice: unitPriceNum,
          currency,
          quantity: Math.floor(qtyNum),
          unit: quoteUnit,
          leadTimeDays: leadTimeDays.trim() ? Math.floor(Number(leadTimeDays)) : undefined,
          validDays: validDays.trim() ? Math.floor(Number(validDays)) : undefined,
          paymentTerms: paymentTerms || undefined,
          message: quoteMessage.trim() || undefined,
        },
      });
      await invalidateRfqQueries(qc, { rfqId });
      await refetch();
      setSuccess(myQuote ? "Quote updated — buyer can compare offers." : "Quote sent — buyer can compare offers.");
    } catch (err) {
      setError(errMessage(err, "Failed to send quote. Please try again."));
    }
  }

  async function onAward(quoteId: number) {
    const ok = await confirm({
      title: "Accept quote & close deal?",
      message: "Accept this quote and close the deal? Other quotes will be declined.",
      confirmLabel: "Accept & close",
      cancelLabel: "Keep comparing",
    });
    if (!ok) return;
    setError("");
    setSuccess("");
    try {
      await awardQuote.mutateAsync({ id: rfqId, data: { quoteId } });
      await invalidateRfqQueries(qc, { rfqId });
      await refetch();
      setSuccess("Deal closed — you accepted this supplier's quote.");
    } catch (err) {
      setError(errMessage(err, "Could not award this quote."));
    }
  }

  async function onCancelRfq() {
    const ok = await confirm({
      title: "Cancel this RFQ?",
      message: "No deal will be made and all quotes will be declined.",
      confirmLabel: "Cancel RFQ",
      cancelLabel: "Keep open",
      destructive: true,
    });
    if (!ok) return;
    setError("");
    try {
      await updateRfq.mutateAsync({ id: rfqId, data: { status: "rejected" } });
      await invalidateRfqQueries(qc, { rfqId });
      await refetch();
      setSuccess("RFQ cancelled.");
    } catch (err) {
      setError(errMessage(err, "Could not cancel RFQ."));
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
    const forbidden = isError && httpStatus(loadError) === 403;
    const sellerBlockedOwn =
      forbidden && user?.role === "seller";
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <Package className="mx-auto mb-3 text-muted-foreground" />
        <h2 className="font-heading font-bold text-xl mb-2">
          {sellerBlockedOwn ? "Switch to buyer mode" : "RFQ not found"}
        </h2>
        <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
          {sellerBlockedOwn
            ? "This is your own request. Seller mode only shows incoming RFQs from buyers. Switch to buyer mode to manage your quotes."
            : "This RFQ is private or no longer available."}
        </p>
        <button
          type="button"
          onClick={() => navigate(sellerBlockedOwn ? "/buyer" : "/rfq")}
          className="text-primary text-sm font-medium"
        >
          {sellerBlockedOwn ? "Go to Buyer Central →" : "← Back to RFQs"}
        </button>
      </div>
    );
  }

  const status = statusConfig[rfq.status as keyof typeof statusConfig] ?? statusConfig.pending;
  const fieldClass =
    "mt-1 w-full border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 bg-white";
  const busy = submitQuote.isPending || awardQuote.isPending || updateRfq.isPending;

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
              {(rfq.quoteCount ?? activeQuotes.length) > 0 && (
                <> · {rfq.quoteCount ?? activeQuotes.length} quote{(rfq.quoteCount ?? activeQuotes.length) === 1 ? "" : "s"}</>
              )}
            </p>
          </div>
          <span className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${status.color}`}>
            {status.icon} {status.label}
          </span>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div className="bg-muted/40 rounded-xl p-3">
            <div className="text-muted-foreground text-xs mb-1">Requested qty</div>
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
            <div className="text-muted-foreground text-xs mb-1">
              {rfq.status === "accepted" ? "Awarded supplier" : "Routing"}
            </div>
            <div className="font-semibold">
              {rfq.supplierName ?? "Open marketplace — all sellers can quote"}
            </div>
          </div>
        </div>

        {rfq.description && (
          <div className="mt-4 text-sm">
            <div className="text-xs text-muted-foreground mb-1">Requirements</div>
            <p className="text-foreground whitespace-pre-wrap">{rfq.description}</p>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 text-sm text-green-700 bg-green-50 border border-green-100 rounded-xl px-3 py-2">
          {success}
        </div>
      )}

      {/* Buyer: compare quotes & award */}
      {isLoggedIn && isBuyer && activeQuotes.length > 0 && (
        <div className="bg-white rounded-2xl border border-border p-6 shadow-sm mb-6 space-y-4">
          <div>
            <h2 className="font-heading font-bold text-lg">
              {rfq.status === "accepted" ? "Winning quote" : "Compare quotes"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {rfq.status === "accepted"
                ? "Deal is closed with the supplier below."
                : "Review offers and accept one to close the deal. Other quotes are then declined."}
            </p>
          </div>

          <div className="space-y-3">
            {activeQuotes.map((q) => {
              const isWinner = q.status === "awarded" || q.id === rfq.awardedQuoteId;
              return (
                <div
                  key={q.id}
                  className={`rounded-xl border p-4 ${
                    isWinner ? "border-green-300 bg-green-50/60" : "border-border bg-muted/20"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-foreground flex items-center gap-2">
                        {q.supplierName}
                        {isWinner && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                            <Trophy size={10} /> Awarded
                          </span>
                        )}
                      </div>
                      <div className="text-2xl font-heading font-bold mt-1">
                        {formatMoney(q.unitPrice, q.currency)}
                        <span className="text-sm font-medium text-muted-foreground">
                          {" "}
                          / {q.unit}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Qty {q.quantity} {q.unit}
                        {q.lineTotal != null && <> · Total {formatMoney(q.lineTotal, q.currency)}</>}
                        {q.leadTimeDays != null && <> · Lead {q.leadTimeDays}d</>}
                        {q.paymentTerms && <> · {q.paymentTerms}</>}
                      </div>
                      {q.message && (
                        <p className="text-sm text-foreground/80 whitespace-pre-wrap mt-2">{q.message}</p>
                      )}
                    </div>
                    {isBuyer && rfq.status === "responded" && q.status === "active" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void onAward(q.id)}
                        className="shrink-0 bg-green-600 text-white px-4 min-h-10 rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-60"
                      >
                        Accept & close deal
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {isBuyer && isOpenForQuotes && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onCancelRfq()}
              className="w-full border border-border py-2.5 rounded-xl font-semibold text-sm hover:bg-muted disabled:opacity-60"
            >
              Cancel RFQ (no deal)
            </button>
          )}
        </div>
      )}

      {isLoggedIn && isBuyer && isOpenForQuotes && activeQuotes.length === 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 mb-6 text-sm text-amber-900">
          Waiting for sellers to send quotes. This page refreshes automatically.
        </div>
      )}

      {/* Seller: own quote status when deal closed */}
      {isLoggedIn && linkedShop && myQuote && dealClosed && (
        <div
          className={`rounded-2xl border p-5 mb-6 ${
            myQuote.status === "awarded"
              ? "bg-green-50 border-green-200"
              : "bg-muted/40 border-border"
          }`}
        >
          <h2 className="font-heading font-bold text-lg mb-1">
            {myQuote.status === "awarded" ? "You won this deal" : "Deal closed"}
          </h2>
          <p className="text-sm text-muted-foreground mb-2">
            {myQuote.status === "awarded"
              ? "The buyer accepted your quote."
              : myQuote.status === "declined"
                ? "Another supplier was awarded, or the buyer cancelled."
                : "This RFQ is no longer open."}
          </p>
          <div className="text-xl font-heading font-bold">
            {formatMoney(myQuote.unitPrice, myQuote.currency)} / {myQuote.unit}
          </div>
        </div>
      )}

      {isLoggedIn && canSendQuote && (
        <form
          onSubmit={(e) => void onSubmitQuote(e)}
          className="bg-white rounded-2xl border border-border p-6 shadow-sm space-y-5"
        >
          <div>
            <h2 className="font-heading font-bold text-lg">
              {myQuote ? "Update your quote" : "Send your best price"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {rfq.supplierId == null
                ? "Open inquiry — multiple sellers can quote. Buyer picks one to close the deal."
                : "Reply with a clear wholesale offer the buyer can accept."}
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground">Unit price</label>
            <div className="mt-1 flex rounded-xl border border-border overflow-hidden focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10">
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                aria-label="Currency"
                title="Currency"
                className="appearance-none cursor-pointer bg-muted/50 text-sm font-semibold text-foreground border-0 border-r border-border pl-3 pr-6 py-2.5 outline-none hover:bg-muted focus:bg-muted"
                style={{
                  backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 0.45rem center",
                }}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.symbol}
                  </option>
                ))}
              </select>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={quotePrice}
                onChange={(e) => setQuotePrice(e.target.value)}
                className="no-spinner flex-1 min-w-0 px-3 py-2.5 text-sm outline-none border-0"
                placeholder="e.g. 185"
                required
              />
              <select
                value={quoteUnit}
                onChange={(e) => setQuoteUnit(e.target.value)}
                aria-label="Unit"
                title="Unit"
                className="appearance-none cursor-pointer bg-muted/30 text-xs text-muted-foreground border-0 border-l border-border pl-2.5 pr-6 py-2.5 outline-none hover:bg-muted/50 focus:bg-muted/50 max-w-[7.5rem]"
                style={{
                  backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 0.4rem center",
                }}
              >
                {!UNITS.includes(quoteUnit as (typeof UNITS)[number]) && (
                  <option value={quoteUnit}>/ {quoteUnit}</option>
                )}
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    / {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground">Offer quantity</label>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              value={quoteQty}
              onChange={(e) => setQuoteQty(e.target.value)}
              className={`${fieldClass} no-spinner`}
              required
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Buyer asked for {rfq.quantity} {rfq.unit}.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Lead time (days)</label>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                value={leadTimeDays}
                onChange={(e) => setLeadTimeDays(e.target.value)}
                className={`${fieldClass} no-spinner`}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">
                Quote valid for (days)
              </label>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                value={validDays}
                onChange={(e) => setValidDays(e.target.value)}
                className={`${fieldClass} no-spinner`}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground">Payment terms</label>
            <select
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              className={fieldClass}
            >
              {PAYMENT_TERMS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground">Message to buyer</label>
            <textarea
              value={quoteMessage}
              onChange={(e) => setQuoteMessage(e.target.value)}
              rows={3}
              className={fieldClass}
              placeholder="MOQ notes, packaging, Incoterms, sample policy…"
            />
          </div>

          {lineTotal != null && (
            <div className="rounded-xl bg-muted/40 border border-border px-4 py-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm text-muted-foreground">
                Estimated line total
                <span className="block text-[11px] mt-0.5">
                  {formatMoney(unitPriceNum, currency)} × {Math.floor(qtyNum)} {quoteUnit}
                </span>
              </div>
              <div className="font-heading text-xl font-bold text-foreground">
                {formatMoney(lineTotal, currency)}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2 bg-primary text-white px-5 min-h-11 rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-60"
          >
            <Send size={14} />
            {submitQuote.isPending ? "Sending…" : myQuote ? "Update Quote" : "Send Quote"}
          </button>
        </form>
      )}
    </div>
  );
}
