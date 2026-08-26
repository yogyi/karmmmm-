import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  BadgeCheck,
  Camera,
  Clock,
  MapPin,
  Package,
  Send,
  Share2,
  Star,
  CheckCircle,
  Loader2,
  Building2,
} from "lucide-react";
import { ProductImage } from "@/components/ProductImage";
import { ImageSourcePicker } from "@/components/ImageSourcePicker";
import { useAuth as useClerkAuth } from "@clerk/react";
import { useUpload } from "@workspace/object-storage-web";
import { useAuth } from "@/context/AuthContext";
import { rememberAuthRedirect } from "@/lib/authRedirect";
import { mediaUrlFromUpload } from "@/lib/mediaUrl";

interface ShareProduct {
  id: number;
  name: string;
  imageUrl: string;
  minPrice: number | null;
  maxPrice: number | null;
  unit: string;
  minOrder: number;
}

interface ShareSupplier {
  id: number;
  slug: string | null;
  companyName: string;
  description: string | null;
  location: string;
  country: string | null;
  city: string | null;
  state: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  shareImageUrl?: string | null;
  videoUrl: string | null;
  verified: boolean;
  yearsInBusiness: number | null;
  employeeCount: string | null;
  mainProducts: string[];
  certifications: string[];
  rating: number;
  reviewCount: number;
  productCount: number;
  responseTime: string | null;
}

/**
 * Seller profile card — /s/:slug
 * Visible only to signed-in Karm users. Inquiries go to CRM (leadSource: share_card).
 */
export function ShareProfilePage({ params }: { params: { slug: string } }) {
  const [, navigate] = useLocation();
  const { isLoaded, isLoggedIn, user } = useAuth();
  const { getToken } = useClerkAuth();
  const [loading, setLoading] = useState(true);
  const [supplier, setSupplier] = useState<ShareSupplier | null>(null);
  const [products, setProducts] = useState<ShareProduct[]>([]);
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaBusy, setMediaBusy] = useState<"cover" | "logo" | null>(null);
  const [mediaMsg, setMediaMsg] = useState<string | null>(null);
  const [ownerShopId, setOwnerShopId] = useState<number | null>(null);
  const { uploadFile } = useUpload({ getToken });
  const [form, setForm] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    country: "",
    productInterest: "",
    message: "",
  });

  useEffect(() => {
    if (!isLoaded) return;
    if (!isLoggedIn) {
      const next = `/s/${params.slug}`;
      rememberAuthRedirect(next);
      navigate(`/login?mode=buyer&redirect=${encodeURIComponent(next)}`);
    }
  }, [isLoaded, isLoggedIn, navigate, params.slug]);

  useEffect(() => {
    if (!user) return;
    setForm((f) => ({
      ...f,
      name: f.name || user.name || "",
      email: f.email || user.email || "",
      company: f.company || user.company || "",
    }));
  }, [user?.id, user?.name, user?.email, user?.company]);

  /** Resolve linked shop id so owners always get cover/logo controls. */
  useEffect(() => {
    if (!isLoaded || !isLoggedIn || !user) return;
    if (user.role !== "seller" && user.role !== "admin") {
      setOwnerShopId(null);
      return;
    }
    if (typeof user.supplierId === "number" && user.supplierId > 0) {
      setOwnerShopId(user.supplierId);
      return;
    }
    let cancelled = false;
    void (async () => {
      const token = await getToken();
      if (!token || cancelled) return;
      const res = await fetch("/api/suppliers/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (cancelled || !res.ok) return;
      const me = (await res.json()) as { id?: number };
      if (typeof me.id === "number") setOwnerShopId(me.id);
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isLoggedIn, user?.id, user?.role, user?.supplierId, getToken]);

  useEffect(() => {
    if (!isLoaded || !isLoggedIn) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const token = await getToken();
      const res = await fetch(`/api/suppliers/by-slug/${encodeURIComponent(params.slug)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (cancelled) return;
      if (res.status === 401) {
        const next = `/s/${params.slug}`;
        rememberAuthRedirect(next);
        navigate(`/login?mode=buyer&redirect=${encodeURIComponent(next)}`);
        return;
      }
      if (!res.ok) {
        setSupplier(null);
        setLoading(false);
        return;
      }
      const data = (await res.json()) as {
        supplier: ShareSupplier;
        products: ShareProduct[];
        shareUrl: string;
      };
      setSupplier(data.supplier);
      setProducts(data.products ?? []);
      setShareUrl(
        typeof window !== "undefined"
          ? `${window.location.origin}${data.shareUrl || `/s/${params.slug}`}`
          : data.shareUrl,
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [params.slug, isLoaded, isLoggedIn, getToken, navigate]);

  async function copyLink() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function saveShopMedia(field: "cover" | "logo", nextUrl: string) {
    const token = await getToken();
    if (!token) throw new Error("Session expired. Please sign in again.");
    const body =
      field === "logo"
        ? { logoUrl: nextUrl }
        : { coverUrl: nextUrl, shareImageUrl: nextUrl };
    const res = await fetch("/api/suppliers/me", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error || "Could not save image");
    }
    setSupplier((prev) =>
      prev
        ? field === "logo"
          ? { ...prev, logoUrl: nextUrl }
          : { ...prev, coverUrl: nextUrl, shareImageUrl: nextUrl }
        : prev,
    );
  }

  async function onPickMedia(field: "cover" | "logo", file: File) {
    if (!supplier) return;

    const looksLikeImage =
      file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif)$/i.test(file.name);
    if (!looksLikeImage) {
      setMediaMsg("Choose a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMediaMsg("Image must be under 5 MB.");
      return;
    }

    setMediaBusy(field);
    setMediaMsg(null);
    const preview = URL.createObjectURL(file);
    setSupplier((prev) =>
      prev
        ? field === "logo"
          ? { ...prev, logoUrl: preview }
          : { ...prev, coverUrl: preview, shareImageUrl: preview }
        : prev,
    );
    try {
      const uploaded = await uploadFile(file);
      const nextUrl = mediaUrlFromUpload(uploaded);
      await saveShopMedia(field, nextUrl);
      setMediaMsg(field === "cover" ? "Cover updated" : "Logo updated");
      window.setTimeout(() => setMediaMsg(null), 2500);
    } catch (err) {
      try {
        const token = await getToken();
        const res = await fetch(`/api/suppliers/by-slug/${encodeURIComponent(params.slug)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = (await res.json()) as { supplier: ShareSupplier };
          setSupplier(data.supplier);
        }
      } catch {
        /* ignore */
      }
      setMediaMsg(err instanceof Error ? err.message : "Could not update image");
    } finally {
      window.setTimeout(() => URL.revokeObjectURL(preview), 500);
      setMediaBusy(null);
    }
  }

  async function submitInquiry(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError("Enter your name.");
      return;
    }
    if (!form.email.trim() && !form.phone.trim()) {
      setError("Add an email or phone so the seller can reach you.");
      return;
    }
    setSending(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/leads/public", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          supplierSlug: params.slug,
          ...form,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not send inquiry");
        return;
      }
      setSent(true);
    } finally {
      setSending(false);
    }
  }

  if (!isLoaded || !isLoggedIn) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center kb-page px-4 text-center">
        <Loader2 className="animate-spin text-primary mb-3" size={28} />
        <p className="text-sm text-muted-foreground">Sign in to Karm Baba to view this seller.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center kb-page">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center">
        <h1 className="font-heading text-2xl font-bold mb-2">Profile not found</h1>
        <p className="text-muted-foreground text-sm mb-6">
          This share link may be invalid or the shop is not set up yet.
        </p>
        <button
          type="button"
          onClick={() => navigate("/suppliers")}
          className="text-primary font-medium text-sm hover:underline"
        >
          Browse suppliers
        </button>
      </div>
    );
  }

  const place = [supplier.city, supplier.state, supplier.country || supplier.location]
    .filter(Boolean)
    .join(", ");
  const cardCover = supplier.shareImageUrl || supplier.coverUrl;
  const isOwner =
    !!user &&
    (user.role === "admin" ||
      (ownerShopId != null && ownerShopId === supplier.id) ||
      (user.supplierId != null && user.supplierId === supplier.id));

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Page atmosphere */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(900px 420px at 12% -10%, hsl(28 100% 50% / 0.18), transparent 55%), radial-gradient(700px 380px at 90% 8%, hsl(220 60% 20% / 0.12), transparent 50%), linear-gradient(180deg, #f8f5f0 0%, #eef1f6 48%, #f4f6f9 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%231a2744' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        }}
      />

      <div className="relative max-w-4xl mx-auto px-4 py-8 sm:py-12">
        {isOwner && mediaMsg ? (
          <div className="mb-3 rounded-xl border border-secondary/10 bg-white/90 px-4 py-2.5 text-sm font-medium text-secondary shadow-sm">
            {mediaMsg}
          </div>
        ) : null}

        <article className="bg-white/95 backdrop-blur-sm rounded-3xl overflow-hidden shadow-[0_20px_50px_-24px_rgba(26,39,68,0.45)] border border-white/70 ring-1 ring-black/[0.04]">
          {/* Hero */}
          <div className="relative group/cover">
            {cardCover ? (
              <div className="relative h-40 sm:h-52">
                <img
                  src={cardCover}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                  key={cardCover}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-secondary/80 via-secondary/20 to-transparent" />
              </div>
            ) : (
              <div className="relative h-36 sm:h-44 overflow-hidden bg-secondary">
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(135deg, hsl(220 60% 16%) 0%, hsl(220 55% 28%) 42%, hsl(28 95% 42%) 130%)",
                  }}
                />
                <div
                  className="absolute -right-10 -top-16 w-64 h-64 rounded-full opacity-30"
                  style={{
                    background: "radial-gradient(circle, hsl(28 100% 60%) 0%, transparent 70%)",
                  }}
                />
                <div
                  className="absolute -left-8 bottom-0 w-48 h-48 rounded-full opacity-20"
                  style={{
                    background: "radial-gradient(circle, #fff 0%, transparent 70%)",
                  }}
                />
                <div
                  className="absolute inset-0 opacity-20 mix-blend-overlay"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(135deg, transparent, transparent 12px, rgba(255,255,255,0.06) 12px, rgba(255,255,255,0.06) 13px)",
                  }}
                />
                {isOwner && !mediaBusy ? (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <p className="text-white/75 text-sm font-medium px-4 text-center">
                      Add a cover photo to make your shop stand out
                    </p>
                  </div>
                ) : null}
              </div>
            )}

            <div className="absolute top-3 right-3 flex items-center gap-2 z-20">
              {isOwner ? (
                <ImageSourcePicker
                  disabled={mediaBusy !== null}
                  preferEnvironment
                  onFile={(file) => void onPickMedia("cover", file)}
                  onError={(msg) => setMediaMsg(msg)}
                >
                  <button
                    type="button"
                    disabled={mediaBusy !== null}
                    className="inline-flex items-center gap-1.5 bg-white/95 text-secondary text-sm font-semibold px-3.5 py-2 rounded-xl shadow-md border border-white/80 hover:bg-white transition-colors disabled:opacity-60"
                  >
                    {mediaBusy === "cover" ? (
                      <Loader2 size={14} className="animate-spin text-primary" />
                    ) : (
                      <Camera size={14} className="text-primary" />
                    )}
                    {mediaBusy === "cover"
                      ? "Uploading…"
                      : cardCover
                        ? "Change cover"
                        : "Add cover"}
                  </button>
                </ImageSourcePicker>
              ) : null}
              <button
                type="button"
                onClick={() => void copyLink()}
                className="inline-flex items-center gap-1.5 bg-white/95 text-secondary text-sm font-semibold px-3.5 py-2 rounded-xl shadow-md border border-white/80 hover:bg-white transition-colors"
              >
                <Share2 size={14} className="text-primary" />
                {copied ? "Copied" : "Share"}
              </button>
            </div>
          </div>

          <div className="px-5 sm:px-8 pb-8">
            {/* Identity — logo then name below on mobile to avoid overlap */}
            <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4 -mt-12 sm:-mt-14 mb-5 relative z-10">
              <div className="relative shrink-0 self-start">
                <div className="w-[5.5rem] h-[5.5rem] sm:w-28 sm:h-28 rounded-2xl bg-white p-[3px] shadow-[0_12px_28px_-10px_rgba(26,39,68,0.5)] overflow-hidden">
                  {supplier.logoUrl ? (
                    <img
                      src={supplier.logoUrl}
                      alt={supplier.companyName}
                      className="w-full h-full object-cover rounded-[0.85rem]"
                      key={supplier.logoUrl}
                    />
                  ) : (
                    <div className="w-full h-full rounded-[0.85rem] bg-gradient-to-br from-primary/20 to-secondary/10 flex items-center justify-center text-3xl font-heading font-black text-primary">
                      {supplier.companyName[0]}
                    </div>
                  )}
                  {mediaBusy === "logo" ? (
                    <span className="absolute inset-[3px] rounded-[0.85rem] bg-black/45 flex items-center justify-center">
                      <Loader2 size={18} className="animate-spin text-white" />
                    </span>
                  ) : null}
                </div>
                {isOwner ? (
                  <ImageSourcePicker
                    disabled={mediaBusy !== null}
                    onFile={(file) => void onPickMedia("logo", file)}
                    onError={(msg) => setMediaMsg(msg)}
                    align="start"
                  >
                    <button
                      type="button"
                      disabled={mediaBusy !== null}
                      className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-secondary text-white border-2 border-white shadow-md flex items-center justify-center hover:bg-secondary/90 disabled:opacity-60"
                      aria-label="Change logo"
                      title="Change logo"
                    >
                      <Camera size={14} />
                    </button>
                  </ImageSourcePicker>
                ) : null}
              </div>
              <div className="min-w-0 flex-1 sm:pb-1 sm:pt-14">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-heading text-2xl sm:text-3xl font-bold text-secondary tracking-tight truncate">
                    {supplier.companyName}
                  </h1>
                  {supplier.verified && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-emerald-800 bg-emerald-100 border border-emerald-200/80 px-2 py-0.5 rounded-md">
                      <BadgeCheck size={12} /> Verified
                    </span>
                  )}
                </div>
                {place && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                    <MapPin size={14} className="text-primary shrink-0" /> {place}
                  </p>
                )}
              </div>
            </div>

            {supplier.description && (
              <p className="text-sm sm:text-[15px] text-foreground/75 leading-relaxed mb-6 max-w-2xl">
                {supplier.description}
              </p>
            )}

            {/* Trust stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-6">
              <StatTile
                icon={<Star size={15} className="text-amber-500 fill-amber-500" />}
                value={supplier.rating.toFixed(1)}
                label={`${supplier.reviewCount} reviews`}
                tone="amber"
              />
              <StatTile
                icon={<Package size={15} className="text-primary" />}
                value={String(supplier.productCount)}
                label="Products"
                tone="orange"
              />
              {supplier.yearsInBusiness != null ? (
                <StatTile
                  icon={<Building2 size={15} className="text-secondary" />}
                  value={`${supplier.yearsInBusiness}+`}
                  label="Years"
                  tone="navy"
                />
              ) : (
                <StatTile
                  icon={<Building2 size={15} className="text-secondary" />}
                  value={supplier.employeeCount || "—"}
                  label="Team size"
                  tone="navy"
                />
              )}
              <StatTile
                icon={<Clock size={15} className="text-sky-600" />}
                value={supplier.responseTime || "Fast"}
                label="Response"
                tone="sky"
              />
            </div>

            {supplier.mainProducts?.length > 0 && (
              <div className="mb-7">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-secondary/55 mb-2.5">
                  Specializes in
                </p>
                <div className="flex flex-wrap gap-2">
                  {supplier.mainProducts.slice(0, 8).map((p) => (
                    <span
                      key={p}
                      className="text-xs font-medium bg-accent text-accent-foreground border border-primary/15 px-3 py-1.5 rounded-full"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {supplier.certifications?.length > 0 && (
              <div className="mb-7 flex flex-wrap gap-2">
                {supplier.certifications.slice(0, 6).map((c) => (
                  <span
                    key={c}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-secondary bg-secondary/[0.06] border border-secondary/10 px-2.5 py-1 rounded-lg"
                  >
                    <BadgeCheck size={11} className="text-primary" />
                    {c}
                  </span>
                ))}
              </div>
            )}

            {products.length > 0 && (
              <div className="mb-8">
                <div className="flex items-end justify-between gap-3 mb-3.5">
                  <div>
                    <h2 className="font-heading text-lg font-bold text-secondary">Featured products</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Tap a product to view details
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {products.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => navigate(`/products/${p.id}`)}
                      className="group text-left rounded-2xl border border-border/80 overflow-hidden bg-white hover:border-primary/40 hover:shadow-[0_12px_28px_-16px_rgba(255,122,0,0.55)] transition-all duration-200"
                    >
                      <div className="kb-product-media aspect-square w-full">
                        <ProductImage
                          src={p.imageUrl}
                          alt={p.name}
                          className="transition-transform duration-300 group-hover:scale-[1.04]"
                        />
                        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/35 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="p-3">
                        <div className="text-sm font-semibold text-secondary line-clamp-2 mb-1 leading-snug">
                          {p.name}
                        </div>
                        <div className="text-xs font-medium text-primary">
                          {p.minPrice != null
                            ? `₹${p.minPrice}${p.maxPrice && p.maxPrice !== p.minPrice ? `–${p.maxPrice}` : ""} / ${p.unit}`
                            : p.unit}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Inquiry */}
            <div className="rounded-2xl border border-secondary/10 overflow-hidden bg-gradient-to-b from-secondary/[0.04] to-white">
              <div className="px-5 sm:px-6 py-4 border-b border-secondary/10 bg-secondary text-white">
                <h2 className="font-heading text-lg font-bold">Request a quote</h2>
                <p className="text-sm text-white/70 mt-0.5">
                  Share your requirements — {supplier.companyName} will follow up from Karm Baba CRM.
                </p>
              </div>

              <div className="p-5 sm:p-6">
                {sent ? (
                  <div className="flex items-start gap-3 rounded-xl bg-emerald-50 border border-emerald-200/80 p-4">
                    <CheckCircle className="text-emerald-600 flex-shrink-0 mt-0.5" size={20} />
                    <div>
                      <p className="font-semibold text-emerald-900 text-sm">Inquiry sent</p>
                      <p className="text-sm text-emerald-800/80 mt-0.5">
                        Thanks — the seller has received your contact details.
                      </p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={(e) => void submitInquiry(e)} className="space-y-3.5">
                    <div className="grid sm:grid-cols-2 gap-3.5">
                      <Field
                        label="Your name *"
                        value={form.name}
                        onChange={(v) => setForm((f) => ({ ...f, name: v }))}
                        required
                      />
                      <Field
                        label="Company"
                        value={form.company}
                        onChange={(v) => setForm((f) => ({ ...f, company: v }))}
                      />
                      <Field
                        label="Email"
                        type="email"
                        value={form.email}
                        onChange={(v) => setForm((f) => ({ ...f, email: v }))}
                        hint="Email or phone required"
                      />
                      <Field
                        label="Phone / WhatsApp"
                        value={form.phone}
                        onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
                        hint="Email or phone required"
                      />
                      <Field
                        label="Country"
                        value={form.country}
                        onChange={(v) => setForm((f) => ({ ...f, country: v }))}
                      />
                      <Field
                        label="Product interest"
                        value={form.productInterest}
                        onChange={(v) => setForm((f) => ({ ...f, productInterest: v }))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-secondary/70 mb-1.5">
                        Message
                      </label>
                      <textarea
                        rows={3}
                        value={form.message}
                        onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                        className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/70"
                        placeholder="Quantity, specs, timeline…"
                      />
                    </div>
                    {error && (
                      <p className="text-sm text-red-600 font-medium bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                        {error}
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={sending}
                      className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-xl text-sm font-bold shadow-[0_10px_24px_-12px_rgba(255,122,0,0.9)] disabled:opacity-60 min-h-11 w-full sm:w-auto transition-colors"
                    >
                      {sending ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Send size={16} />
                      )}
                      Send inquiry
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </article>

        <p className="text-center text-xs text-secondary/50 mt-7">
          Powered by{" "}
          <button
            type="button"
            className="text-primary font-semibold hover:underline"
            onClick={() => navigate("/")}
          >
            Karm Baba
          </button>
        </p>
      </div>
    </div>
  );
}

function StatTile({
  icon,
  value,
  label,
  tone,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  tone: "amber" | "orange" | "navy" | "sky";
}) {
  const tones: Record<typeof tone, string> = {
    amber: "from-amber-50 to-white border-amber-200/70",
    orange: "from-orange-50 to-white border-primary/20",
    navy: "from-slate-50 to-white border-secondary/15",
    sky: "from-sky-50 to-white border-sky-200/70",
  };
  return (
    <div
      className={`rounded-xl border bg-gradient-to-b ${tones[tone]} px-3 py-2.5 min-h-[4.25rem] flex flex-col justify-center`}
    >
      <div className="flex items-center gap-1.5 mb-0.5">{icon}</div>
      <div className="text-sm font-bold text-secondary leading-tight truncate">{value}</div>
      <div className="text-[11px] text-muted-foreground truncate">{label}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type = "text",
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-secondary/70 mb-1.5">{label}</label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
      {hint ? <p className="text-[11px] text-muted-foreground mt-1">{hint}</p> : null}
    </div>
  );
}
