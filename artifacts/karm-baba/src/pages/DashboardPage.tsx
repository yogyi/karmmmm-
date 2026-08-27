import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useSearch } from "wouter";
import { Package, FileText, Clock, Eye, TrendingUp, Plus, CheckCircle, XCircle, MessageSquare, Pencil, Trash2, AlertTriangle, ImageIcon, BadgeCheck, Loader2, Share2, Copy, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useGetDashboardStats,
  useGetSupplierDashboard,
  useListRfqs,
  useListProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  getListProductsQueryKey,
  getGetSupplierDashboardQueryKey,
  getGetDashboardStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth as useClerkAuth } from "@clerk/react";
import { useAuth } from "@/context/AuthContext";
import { ProductFormModal } from "@/components/ProductFormModal";
import { ProductImage } from "@/components/ProductImage";
import { PageHero } from "@/components/PageHero";
import { subscribeRfqBroadcast } from "@/lib/rfqQueries";
import { useSwitchAccountRole } from "@/components/SwitchRoleDialog";
import { toast } from "@/hooks/use-toast";

const statusConfig = {
  pending: { label: "Open", color: "bg-yellow-100 text-yellow-700", icon: <Clock size={12} /> },
  responded: { label: "Quotes in", color: "bg-blue-100 text-blue-700", icon: <MessageSquare size={12} /> },
  pending_confirm: { label: "Awaiting confirm", color: "bg-amber-100 text-amber-900", icon: <Clock size={12} /> },
  accepted: { label: "Deal closed", color: "bg-green-100 text-green-700", icon: <CheckCircle size={12} /> },
  rejected: { label: "Cancelled", color: "bg-red-100 text-red-600", icon: <XCircle size={12} /> },
};

function StatCard({
  icon,
  label,
  value,
  sub,
  color,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
          {icon}
        </div>
        <span className="text-sm font-semibold text-muted-foreground">{label}</span>
      </div>
      <div className="text-3xl font-heading font-bold text-secondary">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5 min-h-[1rem]">
        {sub || "\u00a0"}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="kb-stat p-5 h-full w-full flex flex-col text-left hover:border-primary/30 hover:shadow-md transition-all cursor-pointer"
      >
        {inner}
      </button>
    );
  }

  return (
    <div className="kb-stat p-5 h-full flex flex-col">
      {inner}
    </div>
  );
}

interface ProductRow {
  id: number;
  name: string;
  description?: string | null;
  categoryId: number;
  categoryName?: string | null;
  minPrice: number;
  maxPrice: number;
  unit: string;
  minOrder: number;
  imageUrl: string;
  images?: string[];
  inStock: boolean;
  tags?: string[];
  featured?: boolean;
}

interface DeleteConfirmProps {
  productName: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  loading: boolean;
  error?: string | null;
}

function DeleteConfirm({ productName, onConfirm, onCancel, loading, error }: DeleteConfirmProps) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return createPortal(
    <div
      className="fixed inset-0 z-[300] kb-z-modal flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-confirm-title"
      >
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={22} className="text-red-600" />
        </div>
        <h3 id="delete-confirm-title" className="font-bold text-foreground mb-1">Delete Product?</h3>
        <p className="text-sm text-muted-foreground mb-4">
          <span className="font-medium text-foreground">"{productName}"</span> will be permanently removed from the marketplace.
        </p>
        {error ? (
          <p className="text-sm text-red-600 mb-4" role="alert">{error}</p>
        ) : null}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 min-h-11 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={loading}
            className="flex-1 px-4 min-h-11 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-60"
          >
            {loading ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function DashboardPage() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const { user, isLoaded } = useAuth();
  const { getToken } = useClerkAuth();
  const { switchTo, switching } = useSwitchAccountRole();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const queryClient = useQueryClient();

  const isSupplier = user?.role === "seller" || user?.role === "admin";
  // Never default to another shop — missing link must not become supplier #1 (IDOR).
  const authSupplierId =
    typeof user?.supplierId === "number" && user.supplierId > 0
      ? user.supplierId
      : null;

  const [shopVerified, setShopVerified] = useState<boolean | null>(
    user?.role === "admin" ? true : null,
  );
  /**
   * Sellers with a linked shop open the dashboard immediately; KYC details refresh in the background.
   * Avoids a blank "Loading your shop…" screen when /suppliers/me is slow or cancelled.
   */
  const [shopReady, setShopReady] = useState(
    () =>
      user?.role === "admin" ||
      (typeof user?.supplierId === "number" && user.supplierId > 0),
  );
  const [needsVerify, setNeedsVerify] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [shopLoadError, setShopLoadError] = useState<string | null>(null);
  const [shopCheckNonce, setShopCheckNonce] = useState(0);
  const [shareSlug, setShareSlug] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  /** Shop id from /suppliers/me — fills gaps when auth profile lacks supplierId. */
  const [shopSupplierId, setShopSupplierId] = useState<number | null>(null);

  const supplierId = authSupplierId ?? shopSupplierId;
  const hasLinkedShop = supplierId != null;

  useEffect(() => {
    if (!isLoaded || !user || user.role === "buyer" || user.role === "admin") return;
    let cancelled = false;
    let settled = false;

    const finish = () => {
      settled = true;
      window.clearTimeout(timeoutId);
    };

    const timeoutId = window.setTimeout(() => {
      if (cancelled || settled) return;
      // Never leave sellers on an infinite spinner.
      if (authSupplierId != null) {
        setShopReady(true);
        setNeedsVerify(false);
        setShopLoadError(null);
        return;
      }
      setShopLoadError("Shop check timed out. Retry to continue.");
      setShopReady(false);
    }, 12_000);

    void (async () => {
      setShopLoadError(null);
      try {
        const token = await getTokenRef.current();
        if (cancelled) return;
        if (!token) {
          finish();
          setShopLoadError("Session expired. Sign in again.");
          return;
        }
        const res = await fetch("/api/suppliers/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        if (res.status === 404) {
          finish();
          setNeedsVerify(true);
          setShopReady(false);
          setShopVerified(false);
          setShopSupplierId(null);
          return;
        }
        if (!res.ok) {
          finish();
          // Keep dashboard usable if we already know the shop id.
          if (authSupplierId != null) {
            setShopReady(true);
            setShopLoadError(`Could not refresh shop status (${res.status}).`);
            return;
          }
          setShopLoadError(`Could not load your shop (${res.status}).`);
          setShopReady(false);
          setShopVerified(false);
          return;
        }
        const s = (await res.json()) as {
          id?: number;
          verified?: boolean;
          gstVerified?: boolean;
          gstLiveVerifiedAt?: string | null;
          gstBadge?: boolean;
          verificationStatus?: string;
          slug?: string | null;
          shareUrl?: string | null;
        };
        if (cancelled) return;
        finish();
        const status =
          typeof s.verificationStatus === "string" ? s.verificationStatus : "draft";
        setVerificationStatus(status);
        setShopVerified(
          s.gstBadge === true ||
            s.gstVerified === true ||
            s.gstLiveVerifiedAt != null,
        );
        setShareSlug(s.slug ?? null);
        if (typeof s.id === "number" && s.id > 0) {
          setShopSupplierId(s.id);
        }

        // Free plan still requires GST verification flow (pending review or verified).
        const kycDone = s.verified === true || status === "pending" || status === "verified";
        if (!kycDone) {
          setNeedsVerify(true);
          setShopReady(false);
          return;
        }
        setNeedsVerify(false);
        setShopReady(true);
        setShopLoadError(null);
      } catch {
        if (cancelled) return;
        finish();
        if (authSupplierId != null) {
          setShopReady(true);
          setShopLoadError("Could not refresh shop status. Showing your dashboard anyway.");
          return;
        }
        setShopLoadError("Could not load your shop. Check your connection.");
        setShopReady(false);
        setShopVerified(false);
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
    // Intentionally omit getToken — Clerk recreates it often and was cancelling the fetch mid-flight.
  }, [isLoaded, user?.id, user?.role, authSupplierId, shopCheckNonce]);

  async function ensureShareLink() {
    const token = await getTokenRef.current();
    if (!token) return;
    const res = await fetch("/api/suppliers/me/share-link", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data = (await res.json()) as { slug?: string };
    if (data.slug) setShareSlug(data.slug);
  }

  async function copyShareLink() {
    if (!shareSlug) return;
    const url = `${window.location.origin}/s/${shareSlug}`;
    await navigator.clipboard.writeText(url);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  }

  async function retryShopCheck() {
    setShopLoadError(null);
    setShopCheckNonce((n) => n + 1);
  }

  const { data: platformStats } = useGetDashboardStats({
    query: { enabled: !isSupplier } as any,
  });
  const { data: supplierDash } = useGetSupplierDashboard(supplierId ?? 0, {
    query: { enabled: isSupplier && hasLinkedShop && shopReady } as any,
  });
  const { data: inboxRfqs, refetch: refetchInboxRfqs, isError: inboxRfqsError } = useListRfqs(
    isSupplier ? undefined : user && user.id > 0 ? { buyerId: user.id } : undefined,
    {
      query: {
        // Fetch inbox even before KYC finishes — open RFQs don't require a verified shop.
        enabled: !!user && user.id > 0 && (user.role === "seller" || user.role === "admin" || !isSupplier),
        refetchOnMount: true,
        refetchOnWindowFocus: true,
        refetchInterval: isSupplier ? 45_000 : 90_000,
        staleTime: 20_000,
      } as any,
    },
  );

  const { data: ownBuyerRfqs } = useListRfqs(
    user && user.id > 0 ? { buyerId: user.id } : undefined,
    {
      query: {
        enabled: !!user && user.id > 0 && isSupplier,
        staleTime: 30_000,
      } as any,
    },
  );
  const ownPostedCount = (ownBuyerRfqs ?? []).length;

  useEffect(() => subscribeRfqBroadcast(() => void refetchInboxRfqs()), [refetchInboxRfqs]);

  // Refresh share slug when shop is ready (upgrades legacy name-{id} links).
  useEffect(() => {
    if (!shopReady || !isSupplier) return;
    void ensureShareLink();
  }, [shopReady, isSupplier]);

  const { data: supplierProductsData, refetch: refetchProducts } = useListProducts(
    { supplierId: supplierId ?? undefined },
    { query: { enabled: isSupplier && hasLinkedShop && shopReady } as any }
  );
  const supplierProducts = supplierProductsData?.items ?? [];

  // Same filter as Incoming RFQs — never mix platform totals into seller cards.
  // buyerId may be null when redacted for open marketplace browse.
  const sellerIncomingRfqs = (inboxRfqs ?? []).filter(
    (r) => r.buyerId == null || r.buyerId !== user?.id,
  );
  const incomingRfqCount = sellerIncomingRfqs.length;
  const openRfqCount = sellerIncomingRfqs.filter(
    (r) =>
      r.status === "pending" ||
      r.status === "responded" ||
      r.status === "pending_confirm",
  ).length;
  const recentRfqs = (
    isSupplier
      ? sellerIncomingRfqs
      : inboxRfqs ?? platformStats?.recentRfqs ?? []
  ).slice(0, 5);

  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const tabFromUrl =
    new URLSearchParams(
      searchString.startsWith("?") ? searchString.slice(1) : searchString,
    ).get("tab") === "products"
      ? "products"
      : "overview";
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<ProductRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "products">(tabFromUrl);

  useEffect(() => {
    setActiveTab(tabFromUrl);
  }, [tabFromUrl]);

  useEffect(() => {
    if (isLoaded && user?.role === "buyer") {
      navigate("/buyer");
    }
  }, [isLoaded, user?.role, navigate]);

  function switchTab(tab: "overview" | "products") {
    setActiveTab(tab);
    navigate(tab === "products" ? "/seller?tab=products" : "/seller");
  }

  async function refreshSellerCatalog() {
    const tasks: Promise<unknown>[] = [
      queryClient.invalidateQueries({
        queryKey: getListProductsQueryKey({ supplierId: supplierId ?? undefined }),
      }),
      queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() }),
      refetchProducts(),
    ];
    if (supplierId != null) {
      tasks.push(
        queryClient.invalidateQueries({
          queryKey: getGetSupplierDashboardQueryKey(supplierId),
        }),
      );
    }
    await Promise.all(tasks);
  }

  if (isLoaded && user?.role === "buyer") {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-sm text-muted-foreground">
        Redirecting…
      </div>
    );
  }

  async function handleCreate(data: {
    name: string; description: string; categoryId: number; customCategory?: string;
    minPrice: number; maxPrice: number; unit: string; minOrder: number;
    imageUrl: string; images: string[]; inStock: boolean; tags: string[];
  }) {
    if (supplierId == null) {
      throw new Error("No supplier shop is linked to this account");
    }
    const { customCategory, ...product } = data;
    await createProduct.mutateAsync({
      data: {
        ...product,
        supplierId,
        ...(customCategory ? { customCategory } : {}),
      } as Parameters<typeof createProduct.mutateAsync>[0]["data"],
    });
    await refreshSellerCatalog();
    setAddModalOpen(false);
    switchTab("products");
    toast({
      title: "Product listed",
      description: `"${data.name}" is now live in your catalog.`,
    });
  }

  async function handleUpdate(data: {
    name: string; description: string; categoryId: number; customCategory?: string;
    minPrice: number; maxPrice: number; unit: string; minOrder: number;
    imageUrl: string; images: string[]; inStock: boolean; tags: string[];
  }) {
    if (!editProduct) return;
    const { customCategory, ...product } = data;
    await updateProduct.mutateAsync({
      id: editProduct.id,
      data: {
        ...product,
        ...(customCategory ? { customCategory } : {}),
      } as Parameters<typeof updateProduct.mutateAsync>[0]["data"],
    });
    await refreshSellerCatalog();
    setEditProduct(null);
    toast({
      title: "Product updated",
      description: `"${data.name}" was saved.`,
    });
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const removed = deleteTarget;
    setDeleteError(null);
    try {
      await deleteProduct.mutateAsync({ id: removed.id });
      // Close confirm immediately so the UI never sticks on "Deleting…"
      setDeleteTarget(null);
      toast({
        title: "Product deleted",
        description: `"${removed.name}" was removed from the marketplace.`,
      });
      await refreshSellerCatalog();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message.replace(/^HTTP \d+ [^:]+:\s*/, "")
          : "Could not delete product. Try again.";
      setDeleteError(msg || "Could not delete product. Try again.");
    }
  }

  function toProductRow(product: (typeof supplierProducts)[number]): ProductRow {
    return {
      id: product.id,
      name: product.name,
      description: product.description ?? "",
      categoryId: product.categoryId,
      categoryName: product.categoryName ?? null,
      minPrice: product.minPrice,
      maxPrice: product.maxPrice,
      unit: product.unit,
      minOrder: product.minOrder,
      imageUrl: product.imageUrl,
      images: product.images?.length ? product.images : [product.imageUrl],
      inStock: product.inStock,
      tags: product.tags ?? [],
      featured: product.featured,
    };
  }

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <h2 className="text-xl font-bold mb-2">Please Sign In</h2>
        <p className="text-muted-foreground text-sm mb-4">You need to be logged in to view the dashboard.</p>
        <button onClick={() => navigate("/login?mode=seller")} className="bg-primary text-white px-6 py-2.5 rounded-xl font-medium hover:bg-primary/90 transition-colors">
          Sign In
        </button>
      </div>
    );
  }

  if (isSupplier && user.role !== "admin" && !shopReady) {
    if (shopLoadError) {
      return (
        <div className="max-w-lg mx-auto px-4 py-16 text-center">
          <h2 className="text-xl font-bold mb-2">Seller Central unavailable</h2>
          <p className="text-sm text-muted-foreground mb-6">{shopLoadError}</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              type="button"
              onClick={() => void retryShopCheck()}
              className="bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => navigate("/account")}
              className="border border-border px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-muted"
            >
              Account
            </button>
          </div>
        </div>
      );
    }
    if (needsVerify) {
      return (
        <div className="max-w-lg mx-auto px-4 py-16 text-center">
          <BadgeCheck className="mx-auto text-primary mb-4" size={40} />
          <h2 className="text-xl font-bold mb-2">Complete seller verification</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Free plan includes shop setup with GST and company KYC. Finish verification to unlock
            product listing. You can still browse open RFQs while you finish.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              type="button"
              onClick={() => navigate("/seller/verify")}
              className="bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90"
            >
              Continue verification
            </button>
            <button
              type="button"
              onClick={() => navigate("/rfq")}
              className="border border-border px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-muted"
            >
              View incoming RFQs
            </button>
            <button
              type="button"
              onClick={() => navigate("/account")}
              className="border border-border px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-muted"
            >
              Account
            </button>
          </div>
          {sellerIncomingRfqs.length > 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">
              {openRfqCount > 0
                ? `${openRfqCount} open RFQ${openRfqCount === 1 ? "" : "s"} waiting — `
                : `${incomingRfqCount} RFQ${incomingRfqCount === 1 ? "" : "s"} in your inbox — `}
              <button
                type="button"
                className="text-primary font-semibold hover:underline"
                onClick={() => navigate("/rfq")}
              >
                open inbox
              </button>
            </p>
          ) : inboxRfqsError ? (
            <p className="mt-6 text-sm text-red-600">Could not load RFQs right now.</p>
          ) : null}
        </div>
      );
    }
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 px-4">
        <Loader2 className="animate-spin text-primary" size={28} />
        <p className="text-sm text-muted-foreground">Loading your shop…</p>
        <button
          type="button"
          onClick={() => void retryShopCheck()}
          className="mt-2 text-sm font-semibold text-primary hover:underline"
        >
          Taking too long? Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <PageHero
        compact
        eyebrow={isSupplier ? "Seller Central" : "Admin"}
        title={
          <span className="inline-flex flex-wrap items-center gap-2">
            {isSupplier ? "Your shop workspace" : "Platform Dashboard"}
            {isSupplier && shopVerified ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold bg-white/15 text-white px-2.5 py-1 rounded-full border border-white/20">
                <BadgeCheck size={12} /> Verified
              </span>
            ) : null}
            {isSupplier && !shopVerified && verificationStatus === "pending" ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold bg-amber-400/20 text-amber-100 px-2.5 py-1 rounded-full border border-amber-200/30">
                Review pending
              </span>
            ) : null}
          </span>
        }
        description={
          isSupplier
            ? "Manage products, share your shop card, and respond to wholesale RFQs."
            : `Welcome back, ${user.name}`
        }
        actions={
          <>
            {isSupplier ? (
              <>
                <button
                  type="button"
                  onClick={() => navigate("/seller/leads")}
                  className="hidden sm:inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 border border-white/25 px-4 py-2.5 rounded-xl font-semibold text-sm"
                >
                  <MessageSquare size={16} /> Leads
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/seller/plans")}
                  className="hidden sm:inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 border border-white/25 px-4 py-2.5 rounded-xl font-semibold text-sm"
                >
                  <TrendingUp size={16} /> Plans
                </button>
                <button
                  type="button"
                  onClick={() => setAddModalOpen(true)}
                  className={`inline-flex items-center justify-center gap-2 kb-btn-primary min-h-11 px-4 py-2.5 text-sm ${
                    activeTab === "products" && supplierProducts.length === 0
                      ? "hidden sm:inline-flex"
                      : ""
                  }`}
                >
                  <Plus size={16} /> Add Product
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => navigate(isSupplier ? "/rfq" : "/rfq/new")}
              className="inline-flex items-center justify-center gap-2 bg-white text-secondary min-h-11 px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-white/90"
            >
              <FileText size={16} /> {isSupplier ? "Incoming RFQs" : "Post RFQ"}
            </button>
          </>
        }
      />

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8 min-w-0">
      {isSupplier && !shopVerified && verificationStatus === "pending" && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p>
            Your GSTIN is under review. You can list products and quote RFQs — the verified badge
            appears after Karm Baba approval.
          </p>
          <button
            type="button"
            onClick={() => navigate("/seller/verify")}
            className="shrink-0 font-semibold text-amber-900 underline underline-offset-2"
          >
            View status
          </button>
        </div>
      )}

      {/* Tabs for suppliers */}
      {isSupplier && (
        <div className="flex gap-1 mb-6 bg-white/80 backdrop-blur-sm border border-border/70 p-1 rounded-xl w-full sm:w-fit shadow-[0_8px_20px_-16px_rgba(26,39,68,0.35)]">
          {(["overview", "products"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => switchTab(tab)}
              className={`flex-1 sm:flex-none px-4 py-2.5 sm:py-2 rounded-lg text-sm font-semibold transition-all capitalize ${
                activeTab === tab
                  ? "bg-secondary text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "products"
                ? `Products (${supplierProducts.length})`
                : "Overview"}
            </button>
          ))}
        </div>
      )}

      <AnimatePresence mode="wait">
        {activeTab === "overview" ? (
          <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {isSupplier ? (
                <>
                  <motion.div className="h-full" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
                    <StatCard
                      icon={<Package size={20} />}
                      label="Your Products"
                      value={supplierDash?.productCount ?? supplierProducts.length}
                      sub="Tap to manage catalog"
                      color="bg-primary/10 text-primary"
                      onClick={() => switchTab("products")}
                    />
                  </motion.div>
                  <motion.div className="h-full" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
                    <StatCard
                      icon={<FileText size={20} />}
                      label="Incoming RFQs"
                      value={incomingRfqCount}
                      sub="Tap to open inbox"
                      color="bg-blue-100 text-blue-600"
                      onClick={() => navigate("/rfq")}
                    />
                  </motion.div>
                  <motion.div className="h-full" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
                    <StatCard
                      icon={<Clock size={20} />}
                      label="Open RFQs"
                      value={openRfqCount}
                      sub="Awaiting your quote"
                      color="bg-yellow-100 text-yellow-600"
                      onClick={() => navigate("/rfq")}
                    />
                  </motion.div>
                  <motion.div className="h-full" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
                    <StatCard
                      icon={<TrendingUp size={20} />}
                      label="Response Rate"
                      value={
                        supplierDash?.supplier.responseRate != null
                          ? `${Math.round(Number(supplierDash.supplier.responseRate))}%`
                          : "—"
                      }
                      sub="Quotes vs requests"
                      color="bg-green-100 text-green-600"
                    />
                  </motion.div>
                </>
              ) : platformStats ? (
                <>
                  <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
                    <StatCard icon={<Package size={20} />} label="Total Products" value={platformStats.totalProducts.toLocaleString()} color="bg-primary/10 text-primary" />
                  </motion.div>
                  <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
                    <StatCard icon={<TrendingUp size={20} />} label="Total Suppliers" value={platformStats.totalSuppliers.toLocaleString()} color="bg-blue-100 text-blue-600" />
                  </motion.div>
                  <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
                    <StatCard icon={<FileText size={20} />} label="RFQs Processed" value={platformStats.totalRfqs.toLocaleString()} color="bg-yellow-100 text-yellow-600" />
                  </motion.div>
                  <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
                    <StatCard icon={<Eye size={20} />} label="Registered Users" value={platformStats.totalUsers.toLocaleString()} color="bg-green-100 text-green-600" />
                  </motion.div>
                </>
              ) : (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-xl border border-border p-5 animate-pulse h-28" />
                ))
              )}
            </div>

            {isSupplier && shopReady && (
              <div className="bg-white rounded-xl border border-border p-5 mb-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="font-bold text-foreground flex items-center gap-2 mb-1">
                      <Share2 size={18} className="text-primary" /> Shareable profile card
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Share this link with buyers. Their inquiries appear in CRM Leads.
                    </p>
                    {shareSlug ? (
                      <p className="mt-2 text-xs font-mono bg-muted px-3 py-2 rounded-lg break-all">
                        {typeof window !== "undefined"
                          ? `${window.location.origin}/s/${shareSlug}`
                          : `/s/${shareSlug}`}
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">
                        No share link yet — create one to get your profile card.
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    {shareSlug ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void copyShareLink()}
                          className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl border border-border hover:bg-muted"
                        >
                          <Copy size={14} /> {shareCopied ? "Copied" : "Copy link"}
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(`/s/${shareSlug}`)}
                          className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl bg-primary text-white hover:bg-primary/90"
                        >
                          <ExternalLink size={14} /> Preview card
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void ensureShareLink()}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl bg-primary text-white hover:bg-primary/90"
                      >
                        <Share2 size={14} /> Create shareable card
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => navigate("/seller/plans")}
                      className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl border border-border hover:bg-muted"
                    >
                      Plans
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="grid lg:grid-cols-3 gap-6">
              {/* RFQ table */}
              <div className="lg:col-span-2 bg-white rounded-xl border border-border overflow-hidden">
                <div className="flex items-center justify-between p-5 border-b border-border">
                  <h2 className="font-bold text-foreground">
                    {isSupplier ? "Incoming RFQs" : "Recent RFQs"}
                  </h2>
                  <button onClick={() => navigate("/rfq")} className="text-sm text-primary hover:underline">View All</button>
                </div>
                <div className="divide-y divide-border">
                  {recentRfqs.length === 0 ? (
                    <div className="p-8 text-center text-sm space-y-3">
                      <p className="text-muted-foreground">
                        {isSupplier && ownPostedCount > 0
                          ? `No incoming RFQs from other buyers. You posted ${ownPostedCount} RFQ${ownPostedCount === 1 ? "" : "s"} yourself — other sellers can see those, but they stay under your buyer inbox.`
                          : "No RFQs yet"}
                      </p>
                      {isSupplier && ownPostedCount > 0 ? (
                        <button
                          type="button"
                          disabled={switching}
                          onClick={() => void switchTo("buyer")}
                          className="text-primary font-semibold hover:underline disabled:opacity-60"
                        >
                          {switching ? "Switching…" : "Switch to buyer · view My RFQs"}
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    recentRfqs.map((rfq) => {
                    const status = statusConfig[rfq.status as keyof typeof statusConfig] ?? statusConfig.pending;
                    return (
                      <div
                        key={rfq.id}
                        onClick={() => navigate(`/rfq/${rfq.id}`)}
                        className="flex items-center justify-between p-4 hover:bg-muted/40 cursor-pointer transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm text-foreground truncate">{rfq.productName}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {rfq.buyerName} · {rfq.quantity} {rfq.unit}
                            {rfq.targetPrice && ` · ₹${rfq.targetPrice}/${rfq.unit}`}
                            {isSupplier && rfq.status === "pending" ? " · Reply with quote →" : ""}
                          </div>
                        </div>
                        <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ml-3 flex-shrink-0 ${status.color}`}>
                          {status.icon} {status.label}
                        </span>
                      </div>
                    );
                  })
                  )}
                </div>
              </div>

              {/* Category breakdown / quick actions */}
              <div className="space-y-4">
                {!isSupplier && platformStats?.categoryBreakdown && (
                  <div className="bg-white rounded-xl border border-border overflow-hidden">
                    <div className="p-4 border-b border-border">
                      <h2 className="font-bold text-foreground">Categories</h2>
                    </div>
                    <div className="p-4 space-y-2">
                      {platformStats.categoryBreakdown.slice(0, 6).map(cat => (
                        <div key={cat.categoryName} className="flex items-center gap-2">
                          <div className="text-xs text-muted-foreground flex-1 truncate">{cat.categoryName}</div>
                          <div className="flex items-center gap-1.5">
                            <div className="h-1.5 bg-primary/20 rounded-full overflow-hidden w-16">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, (cat.count / 200) * 100)}%` }} />
                            </div>
                            <span className="text-xs font-medium text-foreground w-6 text-right">{cat.count}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-white rounded-xl border border-border p-4">
                  <h2 className="font-bold text-foreground mb-3">Quick Actions</h2>
                  <div className="space-y-2">
                    {isSupplier && (
                      <button
                        onClick={() => setAddModalOpen(true)}
                        className="w-full flex items-center gap-2 text-sm min-h-11 px-3 rounded-lg hover:bg-muted transition-colors text-foreground"
                      >
                        <span className="text-primary"><Plus size={14} /></span>
                        Add New Product
                      </button>
                    )}
                    {[
                      ...(isSupplier
                        ? [
                            { label: "Incoming RFQs", path: "/rfq", icon: <Clock size={14} /> },
                            { label: "CRM Leads", path: "/seller/leads", icon: <MessageSquare size={14} /> },
                            {
                              label: shareSlug ? "Open shareable card" : "Create shareable card",
                              path: shareSlug ? `/s/${shareSlug}` : "/seller/plans",
                              icon: <Share2 size={14} />,
                            },
                            { label: "Shop plans", path: "/seller/plans", icon: <TrendingUp size={14} /> },
                            { label: "Verification / KYC", path: "/seller/verify", icon: <BadgeCheck size={14} /> },
                          ]
                        : [
                            { label: "Browse Products", path: "/products", icon: <Package size={14} /> },
                            { label: "Find Suppliers", path: "/suppliers", icon: <TrendingUp size={14} /> },
                            { label: "Post RFQ", path: "/rfq/new", icon: <FileText size={14} /> },
                            { label: "My RFQs", path: "/rfq", icon: <Clock size={14} /> },
                          ]),
                    ].map((action) => (
                      <button
                        type="button"
                        key={action.label}
                        onClick={() => navigate(action.path)}
                        className="w-full flex items-center gap-2 text-sm min-h-11 px-3 rounded-lg hover:bg-muted transition-colors text-foreground"
                      >
                        <span className="text-primary">{action.icon}</span>
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div key="products" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* Products management tab */}
            <div className="bg-white rounded-xl border border-border overflow-hidden">
              <div className="flex items-center justify-between gap-3 p-4 sm:p-5 border-b border-border">
                <div className="min-w-0">
                  <h2 className="font-bold text-foreground">My Products</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {supplierProducts.length} product
                    {supplierProducts.length !== 1 ? "s" : ""} listed
                  </p>
                </div>
                {supplierProducts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setAddModalOpen(true)}
                    className="flex-shrink-0 inline-flex items-center gap-1.5 bg-primary text-white px-3 sm:px-4 py-2 rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors"
                  >
                    <Plus size={15} />
                    <span className="sm:hidden">Add</span>
                    <span className="hidden sm:inline">Add Product</span>
                  </button>
                )}
              </div>

              {supplierProducts.length === 0 ? (
                <div className="py-12 sm:py-16 px-4 text-center">
                  <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Package size={28} className="text-muted-foreground" />
                  </div>
                  <h3 className="font-bold text-foreground mb-1">No products yet</h3>
                  <p className="text-sm text-muted-foreground mb-5 max-w-sm mx-auto">
                    Add your first product to start receiving inquiries from buyers.
                  </p>
                  <button
                    type="button"
                    onClick={() => setAddModalOpen(true)}
                    className="inline-flex items-center justify-center gap-2 bg-primary text-white px-5 py-3 rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors w-full max-w-xs"
                  >
                    <Plus size={16} /> Add First Product
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {supplierProducts.map((product) => {
                    const row = toProductRow(product);
                    return (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-start sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 hover:bg-muted/30 transition-colors group"
                    >
                      <button
                        type="button"
                        onClick={() => navigate(`/products/${product.id}`)}
                        className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-muted shrink-0 ring-1 ring-border/60 focus-visible:ring-2 focus-visible:ring-primary"
                        aria-label={`View ${product.name}`}
                      >
                        {product.imageUrl ? (
                          <ProductImage
                            src={product.imageUrl}
                            alt={product.name}
                            fill={false}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center">
                            <ImageIcon size={20} className="text-muted-foreground" />
                          </div>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => navigate(`/products/${product.id}`)}
                        className="flex-1 min-w-0 text-left"
                      >
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-foreground text-sm truncate">{product.name}</h3>
                          {product.inStock ? (
                            <span className="text-[10px] sm:text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full flex-shrink-0">In Stock</span>
                          ) : (
                            <span className="text-[10px] sm:text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full flex-shrink-0">Out of Stock</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          ₹{product.minPrice.toLocaleString()} – ₹{product.maxPrice.toLocaleString()} / {product.unit}
                          <span className="mx-1.5">·</span>
                          MOQ: {product.minOrder} {product.unit}
                        </p>
                        {product.categoryName && (
                          <p className="text-xs text-muted-foreground">{product.categoryName}</p>
                        )}
                      </button>

                      <div className="flex flex-col sm:flex-row gap-1 sm:gap-1.5 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => navigate(`/products/${product.id}`)}
                          className="inline-flex items-center justify-center gap-1.5 min-h-10 min-w-10 sm:px-2.5 rounded-lg border border-border/80 bg-white hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors text-xs font-semibold"
                          aria-label="View product"
                          title="View on marketplace"
                        >
                          <Eye size={15} />
                          <span className="hidden md:inline">View</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteError(null);
                            setEditProduct(row);
                          }}
                          className="inline-flex items-center justify-center gap-1.5 min-h-10 min-w-10 sm:px-2.5 rounded-lg border border-border/80 bg-white hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors text-xs font-semibold"
                          aria-label="Edit product"
                          title="Edit product"
                        >
                          <Pencil size={15} />
                          <span className="hidden md:inline">Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteError(null);
                            setDeleteTarget(row);
                          }}
                          className="inline-flex items-center justify-center gap-1.5 min-h-10 min-w-10 sm:px-2.5 rounded-lg border border-border/80 bg-white hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors text-xs font-semibold"
                          aria-label="Delete product"
                          title="Delete product"
                        >
                          <Trash2 size={15} />
                          <span className="hidden md:inline">Delete</span>
                        </button>
                      </div>
                    </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Product Modal */}
      <ProductFormModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSubmit={handleCreate}
        loading={createProduct.isPending}
        title="Add Product"
      />

      {/* Edit Product Modal */}
      <ProductFormModal
        open={!!editProduct}
        onClose={() => setEditProduct(null)}
        onSubmit={handleUpdate}
        initialValues={editProduct ? {
          id: editProduct.id,
          name: editProduct.name,
          description: editProduct.description ?? "",
          categoryId: editProduct.categoryId,
          minPrice: String(editProduct.minPrice),
          maxPrice: String(editProduct.maxPrice),
          unit: editProduct.unit,
          minOrder: String(editProduct.minOrder),
          imageUrl: editProduct.imageUrl,
          images: editProduct.images ?? [],
          inStock: editProduct.inStock,
          tags: (editProduct.tags ?? []).join(", "),
        } : undefined}
        loading={updateProduct.isPending}
        title="Edit Product"
      />

      {/* Delete Confirm */}
      {deleteTarget && (
        <DeleteConfirm
          productName={deleteTarget.name}
          onConfirm={handleDelete}
          onCancel={() => {
            if (deleteProduct.isPending) return;
            setDeleteTarget(null);
            setDeleteError(null);
          }}
          loading={deleteProduct.isPending}
          error={deleteError}
        />
      )}
      </div>
    </div>
  );
}
