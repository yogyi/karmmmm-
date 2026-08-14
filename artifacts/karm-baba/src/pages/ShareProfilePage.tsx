import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  BadgeCheck,
  MapPin,
  Package,
  Send,
  Share2,
  Star,
  CheckCircle,
  Loader2,
  Clock,
  Award,
  Building2,
} from "lucide-react";
import { ProductImage } from "@/components/ProductImage";
import { useAuth as useClerkAuth } from "@clerk/react";
import { useAuth } from "@/context/AuthContext";
import { rememberAuthRedirect } from "@/lib/authRedirect";

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
      <div className="min-h-[60vh] flex flex-col items-center justify-center bg-[#f4f6f8] px-4 text-center">
        <Loader2 className="animate-spin text-primary mb-3" size={28} />
        <p className="text-sm text-muted-foreground">Sign in to Karm Baba to view this seller.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-[#f4f6f8]">
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
    .map(prettyLabel)
    .join(", ");
  const companyName = prettyLabel(supplier.companyName);
  const initial = companyName.charAt(0).toUpperCase();
  const showRating = supplier.reviewCount > 0;
  const showProductCount = supplier.productCount > 0;
  const hasStats =
    showRating ||
    showProductCount ||
    supplier.yearsInBusiness != null ||
    Boolean(supplier.responseTime) ||
    Boolean(supplier.employeeCount);

  return (
    <div className="min-h-screen bg-[#f3f1ec]">
      <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
        <article className="bg-white rounded-[1.25rem] overflow-hidden border border-black/[0.06] shadow-[0_18px_50px_-28px_rgba(15,23,42,0.45)]">
          <div className="relative h-40 sm:h-52 bg-[#152238]">
            {supplier.coverUrl ? (
              <img
                src={supplier.coverUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.12),transparent_45%),linear-gradient(135deg,#152238_0%,#1e3a5f_55%,#0f172a_100%)]">
                <span className="absolute right-6 bottom-2 font-heading text-[7rem] font-black text-white/10 leading-none select-none">
                  {initial}
                </span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
            <button
              type="button"
              onClick={() => void copyLink()}
              className="absolute top-4 right-4 inline-flex min-h-11 items-center gap-2 bg-white text-sm font-semibold px-3.5 py-2 rounded-lg shadow-sm hover:bg-white/95"
            >
              <Share2 size={15} />
              {copied ? "Link copied" : "Share profile"}
            </button>
          </div>

          <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
            <div className="px-5 sm:px-8 pb-8">
              <div className="flex items-end gap-4 -mt-11 mb-6">
                <div className="w-[5.5rem] h-[5.5rem] sm:w-24 sm:h-24 rounded-2xl bg-white ring-4 ring-white shadow-md overflow-hidden flex-shrink-0">
                  {supplier.logoUrl ? (
                    <img
                      src={supplier.logoUrl}
                      alt={companyName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-[#f4ebe3] flex items-center justify-center font-heading text-3xl font-bold text-[#c45c12]">
                      {initial}
                    </div>
                  )}
                </div>
                <div className="pb-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="font-heading text-[1.35rem] sm:text-[1.7rem] font-semibold tracking-tight text-slate-900">
                      {companyName}
                    </h1>
                    {supplier.verified && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-800 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-md">
                        <BadgeCheck size={13} /> Verified supplier
                      </span>
                    )}
                  </div>
                  {place && (
                    <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-1">
                      <MapPin size={14} className="shrink-0" /> {place}
                    </p>
                  )}
                </div>
              </div>

              {supplier.description && (
                <p className="text-[15px] text-slate-600 leading-relaxed mb-6 max-w-prose">
                  {supplier.description}
                </p>
              )}

              {hasStats ? (
                <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                  {showRating && (
                    <Stat
                      icon={<Star size={15} className="text-amber-500" />}
                      label="Rating"
                      value={`${supplier.rating.toFixed(1)} · ${supplier.reviewCount}`}
                    />
                  )}
                  {showProductCount && (
                    <Stat
                      icon={<Package size={15} />}
                      label="Products"
                      value={String(supplier.productCount)}
                    />
                  )}
                  {supplier.yearsInBusiness != null && (
                    <Stat
                      icon={<Building2 size={15} />}
                      label="Experience"
                      value={`${supplier.yearsInBusiness}+ years`}
                    />
                  )}
                  {supplier.responseTime && (
                    <Stat
                      icon={<Clock size={15} />}
                      label="Response"
                      value={supplier.responseTime}
                    />
                  )}
                  {supplier.employeeCount && (
                    <Stat label="Team" value={supplier.employeeCount} />
                  )}
                </dl>
              ) : null}

              {supplier.mainProducts?.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 mb-2.5">
                    Main products
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {supplier.mainProducts.slice(0, 8).map((p) => (
                      <span
                        key={p}
                        className="text-sm bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-full text-slate-700"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {supplier.certifications?.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 mb-2.5">
                    Certifications
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {supplier.certifications.slice(0, 6).map((c) => (
                      <span
                        key={c}
                        className="inline-flex items-center gap-1.5 text-sm text-slate-700"
                      >
                        <Award size={14} className="text-amber-600" /> {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {products.length > 0 && (
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 mb-3">
                    Featured products
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {products.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => navigate(`/products/${p.id}`)}
                        className="text-left rounded-xl border border-slate-200 overflow-hidden hover:border-slate-400 hover:shadow-sm transition-all bg-white"
                      >
                        <div className="aspect-square bg-slate-100">
                          <ProductImage src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="p-3">
                          <div className="text-sm font-medium line-clamp-2 mb-1 text-slate-900">{p.name}</div>
                          <div className="text-xs text-slate-500">
                            {p.minPrice != null
                              ? `₹${p.minPrice.toLocaleString("en-IN")}${p.maxPrice && p.maxPrice !== p.minPrice ? `–${p.maxPrice.toLocaleString("en-IN")}` : ""} / ${p.unit}`
                              : p.unit}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <aside className="bg-[#f8f6f2] border-t lg:border-t-0 lg:border-l border-black/[0.06] p-5 sm:p-7">
              <h2 className="font-heading text-xl font-semibold text-slate-900">Request a quote</h2>
              <p className="text-sm text-slate-500 mt-1 mb-5 leading-relaxed">
                Send your requirement. This supplier will reply from Karm Baba with pricing and availability.
              </p>

              {sent ? (
                <div className="flex items-start gap-3 rounded-xl bg-emerald-50 border border-emerald-100 p-4">
                  <CheckCircle className="text-emerald-600 flex-shrink-0 mt-0.5" size={20} />
                  <div>
                    <p className="font-semibold text-emerald-900 text-sm">Inquiry sent</p>
                    <p className="text-sm text-emerald-800/80 mt-0.5">
                      The seller has your details and will follow up shortly.
                    </p>
                  </div>
                </div>
              ) : (
                <form onSubmit={(e) => void submitInquiry(e)} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-3.5">
                    <Field
                      label="Your name"
                      required
                      value={form.name}
                      onChange={(v) => setForm((f) => ({ ...f, name: v }))}
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
                    />
                    <Field
                      label="Phone / WhatsApp"
                      value={form.phone}
                      onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
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
                  <p className="text-xs text-slate-500 -mt-1">Email or WhatsApp is required so they can reply.</p>
                  <div>
                    <label className="block text-[13px] font-medium text-slate-700 mb-1.5">
                      Message
                    </label>
                    <textarea
                      rows={4}
                      value={form.message}
                      onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                      className="w-full min-h-[6.5rem] rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-800 focus:ring-2 focus:ring-slate-800/10 placeholder:text-slate-400"
                      placeholder="Quantity, specifications, and delivery timeline"
                    />
                  </div>
                  {error && <p className="text-sm text-red-600">{error}</p>}
                  <button
                    type="submit"
                    disabled={sending}
                    className="w-full inline-flex min-h-11 items-center justify-center gap-2 bg-[#c45c12] hover:bg-[#a84c0e] text-white px-5 py-3 rounded-lg text-sm font-semibold disabled:opacity-60"
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
            </aside>
          </div>
        </article>

        <p className="text-center text-xs text-slate-400 mt-7">
          Powered by{" "}
          <button type="button" className="text-slate-700 font-medium hover:underline" onClick={() => navigate("/")}>
            Karm Baba
          </button>
        </p>
      </div>
    </div>
  );
}

function prettyLabel(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (trimmed !== trimmed.toLowerCase()) return trimmed;
  return trimmed.replace(/\b\w/g, (c) => c.toUpperCase());
}

function Stat({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
      <dt className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold flex items-center gap-1.5">
        {icon}
        {label}
      </dt>
      <dd className="text-sm font-medium text-slate-800 mt-0.5">{value}</dd>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-[13px] font-medium text-slate-700 mb-1.5">
        {label}
        {required ? <span className="text-[#c45c12]"> *</span> : null}
      </label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-800 focus:ring-2 focus:ring-slate-800/10"
      />
    </div>
  );
}
