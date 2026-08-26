import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { FileText, Clock, CheckCircle, XCircle, MessageSquare, Plus, Package, LogIn } from "lucide-react";
import { motion } from "framer-motion";
import { useListRfqs } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { subscribeRfqBroadcast } from "@/lib/rfqQueries";
import { PageHero } from "@/components/PageHero";

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

  useEffect(() => subscribeRfqBroadcast(() => void refetch()), [refetch]);

  async function handleRefresh() {
    setManualRefreshing(true);
    try {
      await refetch();
    } finally {
      setManualRefreshing(false);
    }
  }

  // Defense-in-depth: never show the viewer's own RFQs in seller inbox UI.
  // buyerId may be redacted to null for open marketplace browse — keep those.
  const roleFilteredRfqs = (rfqs ?? []).filter((r) =>
    isSeller
      ? r.buyerId == null || r.buyerId !== user?.id
      : r.buyerId === user?.id,
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

  // Shop owners browsing in buyer mode only see their own posts — not the seller inbox.
  if (
    profileReady &&
    user &&
    user.role === "buyer" &&
    typeof user.supplierId === "number" &&
    user.supplierId > 0
  ) {
    return (
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-6 sm:py-8 min-w-0">
        <div className="text-center py-16 kb-card">
          <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText size={28} className="text-muted-foreground" />
          </div>
          <h1 className="font-heading text-xl font-bold mb-2">Incoming RFQs need Seller mode</h1>
          <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
            You&apos;re in buyer mode, so this page only shows RFQs you posted. Switch to seller to
            see and quote inbound inquiries.
          </p>
          <button
            type="button"
            onClick={() => navigate("/onboarding?change=1")}
            className="kb-btn-primary px-6 py-2.5 text-sm"
          >
            Switch to seller
          </button>
        </div>
      </div>
    );
  }

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

      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-6 sm:py-8 min-w-0">
      {isError && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Could not load RFQs. Please try again.{" "}
          <button type="button" className="underline font-semibold" onClick={() => void refetch()}>
            Try again
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="kb-card p-5 animate-pulse">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <div className="h-5 bg-muted rounded-full w-2/3" />
                  <div className="h-4 bg-muted rounded-full w-1/3" />
                </div>
                <div className="h-6 bg-muted rounded-full w-20 ml-4" />
              </div>
            </div>
          ))}
        </div>
      ) : sortedRfqs?.length === 0 ? (
        <div className="text-center py-20 kb-card">
          <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText size={28} className="text-muted-foreground" />
          </div>
          <h3 className="text-lg font-heading font-bold mb-2">
            {isSeller ? "No incoming RFQs yet" : "No RFQs yet"}
          </h3>
          <p className="text-muted-foreground text-sm mb-6 max-w-xs mx-auto">
            {isSeller
              ? "When buyers post product or open RFQs, they appear here. Share your shop card for direct inquiries too."
              : "Submit your first request for quotation to get wholesale quotes from verified suppliers"}
          </p>
          {isSeller ? (
            <button
              type="button"
              onClick={() => navigate("/seller/plans")}
              className="bg-primary text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-primary/90 transition-colors"
            >
              Share profile card
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate("/rfq/new")}
              className="bg-primary text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
            >
              <Plus size={16} /> Post Your First RFQ
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {sortedRfqs?.map((rfq, i) => {
            const status =
              statusConfig[rfq.status as keyof typeof statusConfig] ?? statusConfig.pending;
            return (
              <motion.div
                key={rfq.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => navigate(`/rfq/${rfq.id}`)}
                className="kb-card-interactive p-4 sm:p-5 cursor-pointer"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-accent border border-accent-border flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Package size={18} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <h3 className="font-semibold text-foreground text-sm sm:text-base leading-tight">
                          {rfq.productName}
                        </h3>
                        <span
                          className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${status.color}`}
                        >
                          {status.icon} {status.label}
                        </span>
                        {isSeller && rfq.supplierId == null && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                            Open inquiry
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-3 sm:gap-x-4 gap-y-1 text-xs sm:text-sm text-muted-foreground">
                        {rfq.categoryName && (
                          <span>
                            Category:{" "}
                            <span className="font-semibold text-foreground">{rfq.categoryName}</span>
                          </span>
                        )}
                        <span>
                          Qty:{" "}
                          <span className="font-semibold text-foreground">
                            {rfq.quantity} {rfq.unit}
                          </span>
                        </span>
                        {rfq.targetPrice && (
                          <span>
                            Target:{" "}
                            <span className="font-semibold text-foreground">
                              ₹{rfq.targetPrice}/{rfq.unit}
                            </span>
                          </span>
                        )}
                        {isSeller && rfq.buyerName && (
                          <span>
                            Buyer:{" "}
                            <span className="font-semibold text-foreground">{rfq.buyerName}</span>
                          </span>
                        )}
                        {!isSeller && rfq.supplierName && (
                          <span className="hidden sm:inline">
                            Supplier:{" "}
                            <span className="font-semibold text-foreground">
                              {rfq.supplierName}
                            </span>
                          </span>
                        )}
                      </div>
                      {rfq.description && (
                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-1">
                          {rfq.description}
                        </p>
                      )}
                      <div className="text-xs text-muted-foreground mt-1.5 font-medium">
                        {new Date(rfq.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/rfq/${rfq.id}`);
                      }}
                      className="w-full sm:w-auto min-h-11 text-sm text-primary border border-primary/30 px-3 rounded-xl hover:bg-primary/5 hover:border-primary transition-colors font-semibold whitespace-nowrap"
                    >
                      Open RFQ
                    </button>
                    {rfq.productId && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/products/${rfq.productId}`);
                        }}
                        className="w-full sm:w-auto min-h-11 text-sm text-muted-foreground border border-border px-3 rounded-xl hover:bg-muted transition-colors font-semibold whitespace-nowrap"
                      >
                        View Product
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}
