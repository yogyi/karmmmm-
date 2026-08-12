import { useLocation } from "wouter";
import {
  Search,
  FileText,
  Heart,
  MessageSquare,
  Clock,
  ArrowRight,
  Package,
  Building2,
  Sparkles,
} from "lucide-react";
import { useListRfqs, useGetFeaturedProducts } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useShortlist } from "@/hooks/useShortlist";

const statusLabel: Record<string, { label: string; className: string }> = {
  pending: { label: "Awaiting quote", className: "bg-yellow-100 text-yellow-800" },
  responded: { label: "Seller replied", className: "bg-blue-100 text-blue-800" },
  accepted: { label: "Accepted", className: "bg-green-100 text-green-800" },
  rejected: { label: "Closed", className: "bg-red-100 text-red-700" },
};

/**
 * Alibaba-style Buyer Central — sourcing hub after buyer sign-in.
 */
export function BuyerCentralPage() {
  const [, navigate] = useLocation();
  const { user, isLoggedIn, isLoaded } = useAuth();
  const { count: shortlistCount } = useShortlist();
  const { data: rfqs, isLoading: loadingRfqs } = useListRfqs(
    {},
    { query: { enabled: isLoggedIn } as any },
  );
  const { data: featured } = useGetFeaturedProducts();

  if (isLoaded && !isLoggedIn) {
    navigate("/login?mode=buyer");
    return null;
  }

  if (isLoaded && user && user.role === "seller") {
    navigate("/seller");
    return null;
  }

  const myRfqs = (rfqs ?? []).filter(
    (r) => user?.id && (r.buyerId === user.id || r.buyerEmail === user.email),
  );
  const openCount = myRfqs.filter((r) => r.status === "pending" || r.status === "responded").length;
  const repliedCount = myRfqs.filter((r) => r.status === "responded").length;
  const products = Array.isArray(featured) ? featured.slice(0, 4) : [];

  return (
    <div className="min-h-screen bg-[#f4f6f8]">
      {/* Buyer Central hero */}
      <section className="bg-secondary text-white">
        <div className="max-w-6xl mx-auto px-4 py-10 sm:py-12">
          <p className="text-xs uppercase tracking-widest text-white/50 mb-2">Buyer Central</p>
          <h1 className="font-heading text-3xl sm:text-4xl font-bold mb-2">
            Welcome{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
          </h1>
          <p className="text-white/65 max-w-xl text-sm sm:text-base mb-6">
            Source products, send RFQs, and manage supplier replies — your buyer workspace on Karm Baba.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigate("/products")}
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl text-sm font-semibold"
            >
              <Search size={16} /> Find products
            </button>
            <button
              type="button"
              onClick={() => navigate("/rfq/new")}
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/15 border border-white/25 text-white px-5 py-2.5 rounded-xl text-sm font-semibold"
            >
              <FileText size={16} /> Post RFQ
            </button>
            <button
              type="button"
              onClick={() => navigate("/shortlist")}
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/15 border border-white/25 text-white px-5 py-2.5 rounded-xl text-sm font-semibold"
            >
              <Heart size={16} /> Shortlist ({shortlistCount})
            </button>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Stat
            icon={<FileText size={18} />}
            label="My RFQs"
            value={myRfqs.length}
            loading={loadingRfqs}
            onClick={() => navigate("/rfq")}
          />
          <Stat
            icon={<Clock size={18} />}
            label="Open inquiries"
            value={openCount}
            loading={loadingRfqs}
            onClick={() => navigate("/rfq")}
          />
          <Stat
            icon={<MessageSquare size={18} />}
            label="Seller replies"
            value={repliedCount}
            loading={loadingRfqs}
            onClick={() => navigate("/rfq")}
          />
          <Stat
            icon={<Heart size={18} />}
            label="Shortlisted"
            value={shortlistCount}
            onClick={() => navigate("/shortlist")}
          />
        </div>

        {/* How sourcing works */}
        <section className="bg-white rounded-2xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={18} className="text-primary" />
            <h2 className="font-semibold text-foreground">How sourcing works</h2>
          </div>
          <div className="grid sm:grid-cols-4 gap-4">
            {[
              { step: "1", title: "Find products", desc: "Browse categories & suppliers" },
              { step: "2", title: "Send RFQ", desc: "Ask for price & MOQ" },
              { step: "3", title: "Compare quotes", desc: "Review seller replies" },
              { step: "4", title: "Deal offline", desc: "Confirm with your supplier" },
            ].map((s) => (
              <div key={s.step} className="rounded-xl bg-muted/40 p-4">
                <div className="w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center mb-2">
                  {s.step}
                </div>
                <div className="font-medium text-sm text-foreground">{s.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{s.desc}</div>
              </div>
            ))}
          </div>
        </section>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* Inquiries */}
          <section className="lg:col-span-3 bg-white rounded-2xl border border-border overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <MessageSquare size={18} className="text-muted-foreground" />
                My inquiries
              </h2>
              <button
                type="button"
                onClick={() => navigate("/rfq")}
                className="text-sm text-primary font-medium inline-flex items-center gap-1"
              >
                View all <ArrowRight size={14} />
              </button>
            </div>
            <div className="divide-y divide-border">
              {loadingRfqs && (
                <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
              )}
              {!loadingRfqs && myRfqs.length === 0 && (
                <div className="p-8 text-center">
                  <Package size={28} className="mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-4">
                    No RFQs yet. Start by posting a request for quotation.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate("/rfq/new")}
                    className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold"
                  >
                    Post your first RFQ
                  </button>
                </div>
              )}
              {myRfqs.slice(0, 5).map((rfq) => {
                const st = statusLabel[rfq.status] ?? statusLabel.pending;
                return (
                  <button
                    key={rfq.id}
                    type="button"
                    onClick={() => navigate(`/rfq/${rfq.id}`)}
                    className="w-full text-left px-5 py-4 hover:bg-muted/40 transition-colors flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-sm text-foreground truncate">
                        {rfq.productName}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">
                        Qty {rfq.quantity} {rfq.unit}
                        {rfq.supplierName ? ` · ${rfq.supplierName}` : ""}
                      </div>
                    </div>
                    <span className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full ${st.className}`}>
                      {st.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Continue sourcing */}
          <section className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl border border-border p-5">
              <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <Building2 size={18} className="text-muted-foreground" />
                Quick links
              </h2>
              <div className="space-y-2">
                {[
                  { label: "Browse all products", path: "/products" },
                  { label: "Verified suppliers", path: "/suppliers?verified=true" },
                  { label: "My shortlist", path: "/shortlist" },
                  { label: "Post a new RFQ", path: "/rfq/new" },
                ].map((l) => (
                  <button
                    key={l.path}
                    type="button"
                    onClick={() => navigate(l.path)}
                    className="w-full flex items-center justify-between rounded-xl border border-border px-3 py-2.5 text-sm hover:bg-muted transition-colors"
                  >
                    {l.label}
                    <ArrowRight size={14} className="text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>

            {products.length > 0 && (
              <div className="bg-white rounded-2xl border border-border p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-foreground text-sm">Recommended for you</h2>
                  <button
                    type="button"
                    onClick={() => navigate("/products")}
                    className="text-xs text-primary font-medium"
                  >
                    More
                  </button>
                </div>
                <div className="space-y-3">
                  {products.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => navigate(`/products/${p.id}`)}
                      className="w-full flex gap-3 text-left hover:bg-muted/50 rounded-xl p-1.5 -m-1.5 transition-colors"
                    >
                      <img
                        src={p.imageUrl}
                        alt=""
                        className="w-14 h-14 rounded-lg object-cover bg-muted shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{p.name}</div>
                        <div className="text-xs text-muted-foreground">
                          ₹{Number(p.minPrice).toLocaleString()} – ₹
                          {Number(p.maxPrice).toLocaleString()} / {p.unit}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        <p className="text-center text-xs text-muted-foreground pb-4">
          Want to sell instead?{" "}
          <button
            type="button"
            onClick={() => navigate("/onboarding?change=1")}
            className="text-primary font-medium hover:underline"
          >
            Switch to Seller Central
          </button>
        </p>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  loading,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  loading?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-white rounded-2xl border border-border p-4 text-left hover:border-primary/40 hover:shadow-sm transition-all"
    >
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold text-foreground">
        {loading ? "—" : value}
      </div>
    </button>
  );
}
