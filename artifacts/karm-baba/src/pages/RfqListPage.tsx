import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { FileText, Clock, CheckCircle, XCircle, MessageSquare, Plus, Package, LogIn } from "lucide-react";
import { motion } from "framer-motion";
import { useListRfqs } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { subscribeRfqBroadcast } from "@/lib/rfqQueries";
import { PageHero } from "@/components/PageHero";
import { useSwitchAccountRole } from "@/components/SwitchRoleDialog";

const statusConfig = {
  pending: { label: "Open for quotes", color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: <Clock size={12} /> },
  responded: { label: "Quotes in", color: "bg-blue-100 text-blue-700 border-blue-200", icon: <MessageSquare size={12} /> },
  pending_confirm: { label: "Awaiting confirm", color: "bg-amber-100 text-amber-900 border-amber-200", icon: <Clock size={12} /> },
  accepted: { label: "Deal closed", color: "bg-green-100 text-green-700 border-green-200", icon: <CheckCircle size={12} /> },
  rejected: { label: "Cancelled", color: "bg-red-100 text-red-600 border-red-200", icon: <XCircle size={12} /> },
};

export function RfqListPage() {
  const [, navigate] = useLocation();
  const { user, isLoggedIn, isLoaded, profileReady } = useAuth();
  const { switchTo, switching } = useSwitchAccountRole();
  const isSeller = user?.role === "seller" || user?.role === "admin";
  const [manualRefreshing, setManualRefreshing] = useState(false);

  // Sellers: bare list — API scopes by linked shop (sending supplierId can 403 on mismatch).
  // Buyers: force buyerId so list is "my RFQs".
  const listParams = useMemo(() => {
    if (!user || user.id <= 0) return undefined;
    if (user.role === "seller" || user.role === "admin") {
      return undefined;
    }
    return { buyerId: user.id };
  }, [user?.id, user?.role]);

  const { data: rfqs, isLoading, refetch, isError } = useListRfqs(listParams, {
    query: {
      enabled: !!user && user.id > 0 && profileReady,
      refetchOnMount: true,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      // Quiet background sync — don't hammer the API / flash the Refresh button
      refetchInterval: isSeller ? 45_000 : 90_000,
      staleTime: 20_000,
    } as any,
  });

  // Sellers who also buy: own posts never appear in the incoming inbox (by design).
  const { data: ownBuyerRfqs } = useListRfqs(
    user && user.id > 0 ? { buyerId: user.id } : undefined,
    {
      query: {
        enabled: !!user && user.id > 0 && profileReady && isSeller,
        staleTime: 30_000,
      } as any,
    },
  );
  const ownPostedCount = (ownBuyerRfqs ?? []).length;

  useEffect(() => subscribeRfqBroadcast(() => void refetch()), [refetch]);

  async function handleRefresh() {
    setManualRefreshing(true);
    try {
      await refetch();
    } finally {
      setManualRefreshing(false);
    }
  }

  // Defense-in-depth for seller inbox: never show the viewer's own buyer RFQs.
  // Buyers: trust the API scope (already filtered to this buyer) — do not re-filter
  // by buyerId (redaction / profile lag used to hide every row as an empty list).
  const roleFilteredRfqs = (rfqs ?? []).filter((r) =>
    isSeller ? r.buyerId == null || r.buyerId !== user?.id : true,
  );

  // Sellers: highest target price first (matches API). Buyers keep API newest-first order.
  const sortedRfqs = isSeller
    ? [...roleFilteredRfqs].sort((a, b) => {
        const ap = a.targetPrice != null ? Number(a.targetPrice) : -1;
        const bp = b.targetPrice != null ? Number(b.targetPrice) : -1;
        if (bp !== ap) return bp - ap;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
    : roleFilteredRfqs;

  if (isLoaded && !isLoggedIn) {
    return (
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-6 sm:py-8 min-w-0">
        <div className="text-center py-20 kb-card">
          <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
            <LogIn size={28} className="text-muted-foreground" />
          </div>
          <h1 className="font-heading text-xl font-bold mb-2">Sign in to view RFQs</h1>
          <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
            Track quotation requests and supplier replies from your account.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              type="button"
              onClick={() => navigate("/login?mode=buyer")}
              className="kb-btn-primary px-6 py-2.5 text-sm"
            >
              Buyer sign in
            </button>
            <button
              type="button"
              onClick={() => navigate("/login?mode=seller")}
              className="border border-border px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-muted"
            >
              Seller sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  const hasSellerShop =
    !!user &&
    typeof user.supplierId === "number" &&
    user.supplierId > 0 &&
    user.role === "buyer";

  return (
    <div>
      <PageHero
        compact
        eyebrow={isSeller ? "Seller Central" : "Buyer Central"}
        title={isSeller ? "Incoming RFQs" : "My RFQs"}
        description={
          isSeller
            ? "Open marketplace + RFQs sent to your shop · highest budget first"
            : "Track and manage your quotation requests"
        }
        actions={
          <>
            <button
              type="button"
              onClick={() => void handleRefresh()}
              className="hidden sm:inline-flex bg-white/10 hover:bg-white/15 border border-white/25 px-3 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60"
              disabled={manualRefreshing}
            >
              {manualRefreshing ? "Refreshing…" : "Refresh"}
            </button>
            {!isSeller ? (
              <button
                type="button"
                onClick={() => navigate("/rfq/new")}
                className="inline-flex items-center gap-2 kb-btn-primary px-4 py-2.5 text-sm"
              >
                <Plus size={16} />
                <span className="hidden sm:inline">Post New RFQ</span>
                <span className="sm:hidden">New RFQ</span>
              </button>
            ) : null}
          </>
        }
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-5 py-8 sm:py-10 min-w-0">
      {hasSellerShop && (
        <div className="mb-5 rounded-xl border border-amber-200/90 bg-amber-50 px-4 py-3 text-sm text-amber-950 flex flex-wrap items-center justify-between gap-3">
          <span className="leading-relaxed">
            You&apos;re in buyer mode — these are RFQs you posted. Incoming seller inquiries need
            Seller Central.
          </span>
          <button
            type="button"
            disabled={switching}
            onClick={() => void switchTo("seller")}
            className="font-semibold underline underline-offset-2 disabled:opacity-60 shrink-0"
          >
            {switching ? "Switching…" : "Switch to seller"}
          </button>
        </div>
      )}
      {isError && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Could not load RFQs. Please try again.{" "}
          <button type="button" className="underline font-semibold" onClick={() => void refetch()}>
            Try again
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 animate-pulse"
            >
              <div className="flex items-start gap-3">
                <div className="hidden sm:block w-9 h-9 rounded-lg bg-muted flex-shrink-0" />
                <div className="flex-1 space-y-2.5 min-w-0">
                  <div className="h-4 bg-muted rounded w-1/3" />
                  <div className="h-3.5 bg-muted rounded w-2/3" />
                  <div className="h-3 bg-muted rounded w-1/4" />
                </div>
                <div className="hidden sm:block h-9 w-24 bg-muted rounded-lg flex-shrink-0" />
              </div>
            </div>
          ))}
        </div>
      ) : sortedRfqs?.length === 0 ? (
        <div className="text-center py-16 rounded-lg border border-border/80 bg-white shadow-sm px-6">
          <div className="w-14 h-14 bg-muted rounded-lg flex items-center justify-center mx-auto mb-4">
            <FileText size={26} className="text-muted-foreground" />
          </div>
          <h3 className="text-lg font-heading font-bold mb-2">
            {isSeller ? "No incoming RFQs yet" : "No RFQs yet"}
          </h3>
          <p className="text-muted-foreground text-sm mb-5 max-w-md mx-auto leading-relaxed">
            {isSeller
              ? ownPostedCount > 0
                ? `You posted ${ownPostedCount} RFQ${ownPostedCount === 1 ? "" : "s"} as a buyer — other sellers can see those. Your own posts never appear here (you can't quote yourself).`
                : "When other buyers post open or product RFQs, they appear here. Share your shop card for direct inquiries too."
              : "Submit your first request for quotation to get wholesale quotes from verified suppliers"}
          </p>
          {isSeller && ownPostedCount > 0 ? (
            <div className="flex flex-wrap gap-3 justify-center mb-3">
              <button
                type="button"
                disabled={switching}
                onClick={() => void switchTo("buyer")}
                className="kb-btn-primary px-6 py-2.5 text-sm disabled:opacity-60"
              >
                {switching ? "Switching…" : "Switch to buyer · My RFQs"}
              </button>
            </div>
          ) : null}
          {isSeller ? (
            <button
              type="button"
              onClick={() => navigate("/seller/plans")}
              className="text-sm font-semibold text-primary hover:underline"
            >
              Share profile card
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate("/rfq/new")}
              className="bg-primary text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
            >
              <Plus size={16} /> Post Your First RFQ
            </button>
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-3 list-none m-0 p-0">
          {sortedRfqs?.map((rfq, i) => {
            const status =
              statusConfig[rfq.status as keyof typeof statusConfig] ?? statusConfig.pending;
            const title =
              rfq.productName && rfq.productName !== "null"
                ? rfq.productName
                : "Untitled inquiry";
            const note =
              typeof rfq.description === "string" && rfq.description.trim()
                ? rfq.description.trim()
                : null;
            const posted = new Date(rfq.createdAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            });
            const meta = [
              rfq.categoryName ? { label: "Category", value: rfq.categoryName } : null,
              {
                label: "Qty",
                value: `${rfq.quantity} ${rfq.unit}`,
              },
              rfq.targetPrice
                ? { label: "Target", value: `₹${rfq.targetPrice}/${rfq.unit}` }
                : null,
              isSeller && rfq.buyerName
                ? { label: "Buyer", value: rfq.buyerName }
                : null,
              isSeller && rfq.buyerEmail?.trim()
                ? { label: "Email", value: rfq.buyerEmail.trim() }
                : null,
              !isSeller
                ? {
                    label: "Supplier",
                    value: rfq.supplierName?.trim() || "Open marketplace",
                  }
                : null,
            ].filter(Boolean) as { label: string; value: string }[];

            return (
              <motion.li
                key={rfq.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.15) }}
              >
                <article
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/rfq/${rfq.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate(`/rfq/${rfq.id}`);
                    }
                  }}
                  className="rounded-xl border border-slate-200 bg-white hover:border-primary/30 hover:shadow-md transition-[border-color,box-shadow] duration-150 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2"
                >
                  <div className="flex items-start gap-3 p-4 sm:p-5">
                    <div className="hidden sm:flex w-9 h-9 rounded-lg bg-orange-50 border border-orange-100 items-center justify-center flex-shrink-0 mt-0.5">
                      <Package size={16} className="text-primary" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-foreground text-[15px] leading-tight truncate max-w-full">
                            {title}
                          </h3>
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${status.color}`}
                          >
                            {status.icon} {status.label}
                          </span>
                          {isSeller && rfq.supplierId == null ? (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                              Open inquiry
                            </span>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/rfq/${rfq.id}`);
                          }}
                          className="hidden sm:inline-flex shrink-0 items-center min-h-9 px-3.5 rounded-lg text-sm font-semibold text-primary border border-primary/30 bg-white hover:bg-primary hover:text-white hover:border-primary transition-colors"
                        >
                          Open RFQ
                        </button>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-1.5 text-sm text-muted-foreground">
                        {meta.map((item, idx) => (
                          <span key={item.label} className="inline-flex items-center gap-1">
                            {idx > 0 ? (
                              <span className="text-slate-300 mx-1.5 select-none" aria-hidden>
                                |
                              </span>
                            ) : null}
                            <span>
                              <span className="text-muted-foreground">{item.label}:</span>{" "}
                              <span className="font-medium text-foreground">{item.value}</span>
                            </span>
                          </span>
                        ))}
                      </div>

                      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <time dateTime={rfq.createdAt}>Posted {posted}</time>
                        {note ? (
                          <>
                            <span className="text-slate-300" aria-hidden>
                              ·
                            </span>
                            <span className="truncate max-w-[min(100%,28rem)]">
                              Note: {note}
                            </span>
                          </>
                        ) : null}
                        {rfq.productId ? (
                          <>
                            <span className="text-slate-300" aria-hidden>
                              ·
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/products/${rfq.productId}`);
                              }}
                              className="font-medium text-primary hover:underline"
                            >
                              View product
                            </button>
                          </>
                        ) : null}
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/rfq/${rfq.id}`);
                        }}
                        className="sm:hidden mt-3 w-full min-h-10 rounded-lg text-sm font-semibold text-primary border border-primary/30 bg-white hover:bg-primary/5 transition-colors"
                      >
                        Open RFQ
                      </button>
                    </div>
                  </div>
                </article>
              </motion.li>
            );
          })}
        </ul>
      )}
      </div>
    </div>
  );
}
