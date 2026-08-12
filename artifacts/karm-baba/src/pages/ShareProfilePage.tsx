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
} from "lucide-react";
import { ProductImage } from "@/components/ProductImage";

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
 * Public shareable seller profile card — /s/:slug
 * Collects buyer inquiries into CRM (leadSource: share_card).
 */
export function ShareProfilePage({ params }: { params: { slug: string } }) {
  const [, navigate] = useLocation();
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
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const res = await fetch(`/api/suppliers/by-slug/${encodeURIComponent(params.slug)}`);
      if (cancelled) return;
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
  }, [params.slug]);

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
      const res = await fetch("/api/leads/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    .join(", ");

  return (
    <div className="min-h-screen bg-[#eef1f4]">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        {/* Shareable card */}
        <article className="bg-white rounded-2xl overflow-hidden shadow-lg border border-border/60">
          <div className="relative h-36 sm:h-44 bg-gradient-to-br from-secondary via-secondary/90 to-blue-900">
            {supplier.coverUrl && (
              <img
                src={supplier.coverUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <button
              type="button"
              onClick={() => void copyLink()}
              className="absolute top-3 right-3 inline-flex items-center gap-1.5 bg-white/95 text-sm font-semibold px-3 py-1.5 rounded-lg shadow-sm"
            >
              <Share2 size={14} />
              {copied ? "Copied" : "Share"}
            </button>
          </div>

          <div className="px-5 sm:px-8 pb-8">
            <div className="flex items-end gap-4 -mt-10 mb-4">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white border-4 border-white shadow-md overflow-hidden flex-shrink-0">
                {supplier.logoUrl ? (
                  <img
                    src={supplier.logoUrl}
                    alt={supplier.companyName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-primary/10 flex items-center justify-center text-3xl font-heading font-black text-primary">
                    {supplier.companyName[0]}
                  </div>
                )}
              </div>
              <div className="pb-1 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-heading text-xl sm:text-2xl font-bold truncate">
                    {supplier.companyName}
                  </h1>
                  {supplier.verified && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                      <BadgeCheck size={12} /> Verified
                    </span>
                  )}
                </div>
                {place && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin size={13} /> {place}
                  </p>
                )}
              </div>
            </div>

            {supplier.description && (
              <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                {supplier.description}
              </p>
            )}

            <div className="flex flex-wrap gap-3 text-xs sm:text-sm mb-5">
              <Meta
                icon={<Star size={14} className="text-amber-500" />}
                label={`${supplier.rating.toFixed(1)} · ${supplier.reviewCount} reviews`}
              />
              <Meta
                icon={<Package size={14} />}
                label={`${supplier.productCount} products`}
              />
              {supplier.yearsInBusiness != null && (
                <Meta label={`${supplier.yearsInBusiness}+ years`} />
              )}
              {supplier.responseTime && <Meta label={`Replies in ${supplier.responseTime}`} />}
            </div>

            {supplier.mainProducts?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-6">
                {supplier.mainProducts.slice(0, 8).map((p) => (
                  <span
                    key={p}
                    className="text-xs bg-muted px-2.5 py-1 rounded-lg text-foreground/80"
                  >
                    {p}
                  </span>
                ))}
              </div>
            )}

            {products.length > 0 && (
              <div className="mb-8">
                <h2 className="text-sm font-semibold mb-3">Featured products</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {products.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => navigate(`/products/${p.id}`)}
                      className="text-left rounded-xl border border-border overflow-hidden hover:border-primary/40 transition-colors"
                    >
                      <div className="aspect-square bg-muted">
                        <ProductImage src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="p-2.5">
                        <div className="text-xs font-medium line-clamp-2 mb-1">{p.name}</div>
                        <div className="text-[11px] text-muted-foreground">
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

            {/* Data collection form */}
            <div className="border-t border-border pt-6">
              <h2 className="font-heading text-lg font-bold mb-1">Request a quote</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Share your details — this seller will follow up from their Karm Baba CRM.
              </p>

              {sent ? (
                <div className="flex items-start gap-3 rounded-xl bg-emerald-50 border border-emerald-100 p-4">
                  <CheckCircle className="text-emerald-600 flex-shrink-0 mt-0.5" size={20} />
                  <div>
                    <p className="font-semibold text-emerald-900 text-sm">Inquiry sent</p>
                    <p className="text-sm text-emerald-800/80 mt-0.5">
                      Thanks — the seller has received your contact details.
                    </p>
                  </div>
                </div>
              ) : (
                <form onSubmit={(e) => void submitInquiry(e)} className="space-y-3">
                  <div className="grid sm:grid-cols-2 gap-3">
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
                      label="Email (email or phone required)"
                      type="email"
                      value={form.email}
                      onChange={(v) => setForm((f) => ({ ...f, email: v }))}
                    />
                    <Field
                      label="Phone / WhatsApp (email or phone required)"
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
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Message
                    </label>
                    <textarea
                      rows={3}
                      value={form.message}
                      onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                      className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      placeholder="Quantity, specs, timeline…"
                    />
                  </div>
                  {error && <p className="text-sm text-red-600">{error}</p>}
                  <button
                    type="submit"
                    disabled={sending}
                    className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60"
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
        </article>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Powered by{" "}
          <button type="button" className="text-primary font-medium" onClick={() => navigate("/")}>
            Karm Baba
          </button>
        </p>
      </div>
    </div>
  );
}

function Meta({ icon, label }: { icon?: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-muted/80 px-2.5 py-1 rounded-lg text-muted-foreground">
      {icon}
      {label}
    </span>
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
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
    </div>
  );
}
