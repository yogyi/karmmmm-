import { useState } from "react";
import { useLocation } from "wouter";
import { Search, Shield, TrendingUp, Headphones, ArrowRight, CheckCircle, Package, Cpu, Shirt, Leaf, Wrench, Zap, Home, Car, Activity, Star, BadgeCheck, Sparkles, Globe, Users, MessageSquareQuote, Factory, Trophy } from "lucide-react";
import { motion } from "framer-motion";
import { useGetFeaturedProducts, useGetFeaturedSuppliers, useListCategories, useGetDashboardStats, useListProducts, useListSuppliers } from "@workspace/api-client-react";
import { StarRating } from "@/components/StarRating";
import { ProductImage } from "@/components/ProductImage";
import { SupplierCard } from "@/components/SupplierCard";

const categoryIcons: Record<string, React.ReactNode> = {
  Cpu: <Cpu size={24} />,
  Shirt: <Shirt size={24} />,
  Leaf: <Leaf size={24} />,
  Wrench: <Wrench size={24} />,
  Zap: <Zap size={24} />,
  Home: <Home size={24} />,
  Car: <Car size={24} />,
  Activity: <Activity size={24} />,
};

const categoryGradients = [
  "from-blue-500 to-cyan-400",
  "from-orange-500 to-amber-400",
  "from-green-500 to-emerald-400",
  "from-purple-500 to-violet-400",
  "from-yellow-500 to-orange-400",
  "from-red-500 to-rose-400",
  "from-indigo-500 to-blue-400",
  "from-teal-500 to-green-400",
];

function SkeletonCard() {
  return (
    <div className="kb-card overflow-hidden animate-pulse">
      <div className="bg-muted h-48 w-full" />
      <div className="p-4 space-y-2.5">
        <div className="h-4 bg-muted rounded-full w-3/4" />
        <div className="h-3 bg-muted rounded-full w-1/2" />
        <div className="h-3 bg-muted rounded-full w-1/3" />
      </div>
    </div>
  );
}

export function HomePage() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: featuredProducts, isLoading: loadingProducts, isError: featuredProductsError, refetch: refetchFeaturedProducts } = useGetFeaturedProducts();
  const { data: featuredSuppliers, isLoading: loadingSuppliers, isError: featuredSuppliersError, refetch: refetchFeaturedSuppliers } = useGetFeaturedSuppliers();
  const { data: catalog } = useListProducts({ limit: 8, page: 1, sort: "newest" } as any);
  const { data: supplierCatalog } = useListSuppliers({ limit: 4, page: 1, verified: true } as any);
  const { data: categories } = useListCategories();
  const { data: stats } = useGetDashboardStats();

  const products = Array.isArray(featuredProducts) && featuredProducts.length > 0
    ? featuredProducts.slice(0, 6)
    : (catalog?.items ?? []).slice(0, 6);
  const suppliers = Array.isArray(featuredSuppliers) && featuredSuppliers.length > 0
    ? featuredSuppliers.slice(0, 4)
    : (supplierCatalog?.items ?? []).slice(0, 4);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
  }

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden text-white hero-pattern">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/25 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/3 blur-3xl pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 py-16 sm:py-24 text-center">
          {/* Trust badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-sm text-white/90 mb-6"
          >
            <Sparkles size={14} className="text-primary" />
            India's #1 B2B Wholesale Marketplace
            <BadgeCheck size={14} className="text-green-400" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="font-heading text-4xl sm:text-6xl font-bold mb-4 leading-tight"
          >
            Find Trusted{" "}
            <span className="gradient-text">Wholesale Suppliers</span>
            <br className="hidden sm:block" /> Across India
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="text-white/70 text-lg sm:text-xl mb-10 max-w-2xl mx-auto"
          >
            Connect with 10,000+ verified manufacturers and wholesalers. Get the best wholesale prices, guaranteed.
          </motion.p>

          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            onSubmit={handleSearch}
            className="max-w-2xl mx-auto"
          >
            <div className="relative flex items-center bg-white rounded-2xl overflow-hidden shadow-2xl ring-4 ring-white/20 min-w-0">
              <Search
                size={18}
                aria-hidden
                className="pointer-events-none absolute left-3.5 sm:left-5 top-1/2 -translate-y-1/2 text-muted-foreground z-[1]"
              />
              <input
                type="text"
                enterKeyHint="search"
                autoComplete="off"
                placeholder="Search products…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                aria-label="Search products, suppliers, and categories"
                className="flex-1 min-w-0 pl-11 sm:pl-12 pr-2 sm:pr-4 py-3.5 sm:py-4 text-foreground outline-none text-sm sm:text-base placeholder:text-muted-foreground"
                style={{ caretColor: "hsl(var(--foreground))" }}
              />
              <button
                type="submit"
                aria-label="Search"
                className="relative z-[1] bg-primary hover:bg-primary/90 text-white px-4 sm:px-6 py-3.5 sm:py-4 font-semibold text-base transition-all flex-shrink-0 flex items-center gap-2 rounded-r-2xl min-h-11"
              >
                <Search size={16} />
                <span className="hidden sm:inline">Search</span>
              </button>
            </div>
          </motion.form>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            className="mt-6 flex flex-wrap justify-center gap-2 text-sm"
          >
            <span className="text-white/50 self-center">Trending:</span>
            {["Cotton Fabric", "LED Bulbs", "Basmati Rice", "CNC Machines", "Surgical Gloves"].map(term => (
              <button
                key={term}
                onClick={() => navigate(`/products?search=${encodeURIComponent(term)}`)}
                className="bg-white/10 hover:bg-white/20 text-white/90 px-3 py-1 rounded-full transition-colors border border-white/15 hover:border-white/30 min-h-11 inline-flex items-center"
              >
                {term}
              </button>
            ))}
          </motion.div>

          {/* Mini trust indicators */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="mt-10 flex flex-wrap justify-center gap-6 text-sm text-white/60"
          >
            {[
              { icon: <BadgeCheck size={16} className="text-green-400" />, text: "KYC Verified Suppliers" },
              { icon: <Globe size={16} className="text-blue-400" />, text: "Pan-India Shipping" },
              { icon: <Users size={16} className="text-amber-400" />, text: "Trusted by Buyers" },
            ].map(item => (
              <div key={item.text} className="flex items-center gap-1.5">
                {item.icon}
                <span>{item.text}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Stats bar */}
      {stats && typeof stats === "object" && "totalProducts" in stats && (
        <section className="bg-white border-b border-border shadow-sm">
          <div className="max-w-5xl mx-auto px-4 py-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            {[
              { label: "Products Listed", value: stats.totalProducts, icon: <Package size={20} />, color: "text-orange-500 bg-orange-50" },
              { label: "Verified Suppliers", value: stats.totalSuppliers, icon: <BadgeCheck size={20} />, color: "text-green-600 bg-green-50" },
              { label: "RFQs Processed", value: stats.totalRfqs, icon: <TrendingUp size={20} />, color: "text-blue-500 bg-blue-50" },
              { label: "Registered Buyers", value: stats.totalUsers, icon: <Users size={20} />, color: "text-secondary bg-secondary/10" },
            ].map(stat => (
              <div key={stat.label} className="flex flex-col items-center gap-1.5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.color}`}>
                  {stat.icon}
                </div>
                <div className="text-2xl font-heading font-bold text-foreground">{(stat.value ?? 0).toLocaleString()}+</div>
                <div className="text-xs text-muted-foreground font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10 py-8 sm:py-12 space-y-12 sm:space-y-16 min-w-0">

        {/* Categories */}
        {Array.isArray(categories) && categories.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-7">
              <div>
                <h2 className="font-heading text-2xl font-bold text-foreground">Browse by Category</h2>
                <p className="text-muted-foreground text-sm mt-1">Find exactly what your business needs</p>
              </div>
              <button onClick={() => navigate("/products")} className="text-primary text-sm font-semibold flex items-center gap-1.5 hover:gap-2.5 transition-all group">
                View All <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {categories.map((cat, i) => (
                <motion.button
                  key={cat.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => navigate(`/products?categoryId=${cat.id}`)}
                  className="bg-white rounded-2xl p-4 flex flex-col items-center gap-3 border border-border hover:border-primary/30 hover:shadow-lg transition-all group text-center card-hover"
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${categoryGradients[i % categoryGradients.length]} flex items-center justify-center text-white shadow-sm group-hover:scale-110 transition-transform`}>
                    {categoryIcons[cat.icon ?? ""] ?? <Package size={24} />}
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-foreground leading-tight block">{cat.name}</span>
                    <span className="text-xs text-muted-foreground mt-0.5 block">{cat.productCount} items</span>
                  </div>
                </motion.button>
              ))}
            </div>
          </section>
        )}

        {/* Featured Products */}
        <section>
          <div className="flex items-center justify-between mb-7">
            <div>
              <h2 className="font-heading text-2xl font-bold text-foreground">Featured Wholesale Products</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Hot-selling bulk items from verified Indian manufacturers — ready for RFQ
              </p>
            </div>
            <button onClick={() => navigate("/products")} className="text-primary text-sm font-semibold flex items-center gap-1.5 hover:gap-2.5 transition-all group">
              View All <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {loadingProducts && products.length === 0
              ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
              : featuredProductsError && products.length === 0
                ? null
              : products.map((product, i) => (
                <motion.div
                  key={product.id}
                  role="link"
                  tabIndex={0}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  onClick={() => navigate(`/products/${product.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate(`/products/${product.id}`);
                    }
                  }}
                  className="kb-card-interactive overflow-hidden text-left group cursor-pointer p-0 m-0"
                >
                  <div className="kb-product-media h-40 w-full">
                    <ProductImage
                      src={product.imageUrl}
                      alt={product.name}
                      className="group-hover:scale-[1.04] transition-transform duration-500 ease-out"
                    />
                    {i < 2 && (
                      <div className="absolute top-2.5 left-2.5 z-[2] bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Star size={9} className="fill-white" /> Featured
                      </div>
                    )}
                    {(product as { supplierVerified?: boolean }).supplierVerified && (
                      <div className="absolute top-2.5 right-2.5 z-[2] bg-white/95 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle size={9} /> Verified
                      </div>
                    )}
                    <div className="absolute inset-0 z-[1] hidden md:flex items-center justify-center pointer-events-none bg-secondary/0 opacity-0 transition-all duration-300 group-hover:bg-secondary/50 group-hover:opacity-100">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary text-white text-[11px] font-semibold tracking-wide px-4 py-2 shadow-[0_10px_28px_-10px_rgba(255,122,0,0.85)] translate-y-2 scale-95 group-hover:translate-y-0 group-hover:scale-100 transition-all duration-300">
                        Request quote
                        <span aria-hidden className="text-white/90">→</span>
                      </span>
                    </div>
                  </div>
                  <div className="p-3">
                    <h3 className="text-xs font-semibold text-foreground line-clamp-2 leading-tight mb-1.5">{product.name}</h3>
                    <div className="text-primary font-bold text-sm">₹{product.minPrice}–{product.maxPrice}</div>
                    <div className="text-[11px] text-muted-foreground">per {product.unit} · MOQ {product.minOrder}</div>
                    <span className="mt-2 md:hidden inline-flex items-center justify-center w-full min-h-10 rounded-xl bg-primary text-white text-[11px] font-bold px-2">
                      Get quote →
                    </span>
                    {product.reviewCount != null && product.reviewCount > 0 && product.rating != null ? (
                      <div className="mt-1.5"><StarRating rating={product.rating} reviewCount={product.reviewCount} size={10} /></div>
                    ) : (
                      <div className="mt-1.5 text-[11px] text-muted-foreground">No reviews yet</div>
                    )}
                    {product.supplierName && (
                      <div className="mt-1.5 text-[11px] text-muted-foreground truncate">{product.supplierName}</div>
                    )}
                  </div>
                </motion.div>
              ))}
          </div>
          {featuredProductsError && products.length === 0 && (
            <div className="text-center py-10 text-sm border border-red-100 bg-red-50 rounded-2xl space-y-3">
              <p className="text-red-800">Couldn’t load featured products.</p>
              <button
                type="button"
                className="text-primary font-semibold"
                onClick={() => void refetchFeaturedProducts()}
              >
                Try again
              </button>
            </div>
          )}
          {!loadingProducts && !featuredProductsError && products.length === 0 && (
            <div className="text-center py-10 text-sm text-muted-foreground border border-dashed border-border rounded-2xl">
              No featured products yet.{" "}
              <button className="text-primary font-semibold" onClick={() => navigate("/products")}>Browse catalog →</button>
            </div>
          )}
        </section>

        {/* Suppliers + shortcuts — tinted band so white cards aren’t washed out */}
        <div className="relative overflow-hidden rounded-[1.75rem] border border-secondary/10 bg-gradient-to-br from-[#dce6f4] via-[#e8eef7] to-[#f3e6d8] p-5 sm:p-7 lg:p-8 space-y-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
          <div
            className="pointer-events-none absolute inset-0 opacity-50"
            style={{
              backgroundImage:
                "radial-gradient(ellipse 55% 45% at 0% 0%, rgba(255,122,0,0.18), transparent 55%), radial-gradient(ellipse 45% 40% at 100% 100%, rgba(26,39,68,0.12), transparent 50%)",
            }}
            aria-hidden
          />

          <section className="relative">
            <div className="flex items-center justify-between mb-6 gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-secondary/90 text-white text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 mb-2.5 shadow-sm">
                  <BadgeCheck size={12} className="text-emerald-300" /> Verified network
                </div>
                <h2 className="font-heading text-2xl font-bold text-secondary">Top Verified Suppliers</h2>
                <p className="text-secondary/65 text-sm mt-1">
                  KYC-checked manufacturers ready to quote
                </p>
              </div>
              <button
                onClick={() => navigate("/suppliers?verified=true")}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-white/80 hover:bg-white border border-secondary/15 text-secondary text-sm font-semibold px-3.5 py-2.5 transition-colors group shadow-sm"
              >
                View All <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 sm:gap-6">
              {loadingSuppliers && suppliers.length === 0
                ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="kb-card overflow-hidden animate-pulse h-full border border-secondary/12">
                    <div className="px-5 pt-5 pb-4 bg-gradient-to-br from-[#fff7ef] via-white to-[#f3f6fb]">
                      <div className="flex gap-3.5">
                        <div className="w-14 h-14 bg-muted rounded-2xl flex-shrink-0" />
                        <div className="flex-1 space-y-2 pt-1">
                          <div className="h-3.5 bg-muted rounded-full w-3/4" />
                          <div className="h-3 bg-muted rounded-full w-1/2" />
                        </div>
                      </div>
                    </div>
                    <div className="px-5 pb-5 pt-1 space-y-3.5">
                      <div className="h-3 bg-muted rounded-full w-2/3" />
                      <div className="h-8" />
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="h-10 bg-muted rounded-xl" />
                        <div className="h-10 bg-muted rounded-xl" />
                      </div>
                    </div>
                  </div>
                ))
                : featuredSuppliersError && suppliers.length === 0
                  ? null
                : suppliers.map((supplier, i) => (
                  <motion.div
                    key={supplier.id}
                    className="h-full"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                  >
                    <SupplierCard
                      supplier={supplier}
                      index={i}
                      className="h-full"
                      onClick={() => navigate(`/suppliers/${supplier.id}`)}
                    />
                  </motion.div>
                ))}
            </div>
            {featuredSuppliersError && suppliers.length === 0 && (
              <div className="text-center py-10 text-sm border border-red-100 bg-red-50 rounded-2xl space-y-3 mt-4">
                <p className="text-red-800">Couldn’t load featured suppliers.</p>
                <button
                  type="button"
                  className="text-primary font-semibold"
                  onClick={() => void refetchFeaturedSuppliers()}
                >
                  Try again
                </button>
              </div>
            )}
            {!loadingSuppliers && !featuredSuppliersError && suppliers.length === 0 && (
              <div className="text-center py-10 text-sm text-secondary/70 border border-dashed border-secondary/25 rounded-2xl mt-4 bg-white/50">
                No suppliers yet.{" "}
                <button className="text-primary font-semibold" onClick={() => navigate("/suppliers")}>Browse directory →</button>
              </div>
            )}
          </section>

          <section className="relative grid sm:grid-cols-3 gap-4">
            {[
              {
                title: "Request a quote",
                desc: "Post your requirement once — suppliers compete with quotes.",
                cta: "Request quote",
                path: "/rfq/new",
                icon: MessageSquareQuote,
                card: "bg-gradient-to-br from-primary to-amber-600 text-white border-transparent shadow-[0_14px_32px_-14px_rgba(255,122,0,0.65)] hover:brightness-105",
                descClass: "text-white/85",
              },
              {
                title: "Verified Manufacturers",
                desc: "Source only from KYC-checked suppliers with ratings.",
                cta: "Browse suppliers",
                path: "/suppliers?verified=true",
                icon: Factory,
                card: "bg-gradient-to-br from-emerald-700 to-teal-600 text-white border-transparent shadow-[0_14px_32px_-14px_rgba(4,120,87,0.55)] hover:brightness-105",
                descClass: "text-emerald-50/90",
              },
              {
                title: "Top Ranking Products",
                desc: "Discover featured wholesale picks trending this week.",
                cta: "View products",
                path: "/products",
                icon: Trophy,
                card: "bg-gradient-to-br from-secondary to-[#2a3f66] text-white border-transparent shadow-[0_14px_32px_-14px_rgba(26,39,68,0.55)] hover:brightness-105",
                descClass: "text-white/80",
              },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <button
                  key={card.title}
                  onClick={() => navigate(card.path)}
                  className={`group text-left rounded-2xl border p-5 sm:p-6 transition-all ${card.card}`}
                >
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 bg-white/15 backdrop-blur-sm">
                    <Icon size={20} />
                  </div>
                  <h3 className="font-heading font-bold text-lg mb-1.5">{card.title}</h3>
                  <p className={`text-sm mb-4 leading-relaxed ${card.descClass}`}>{card.desc}</p>
                  <span className="text-sm font-semibold inline-flex items-center gap-1.5 text-white">
                    {card.cta}
                    <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </button>
              );
            })}
          </section>
        </div>

        {/* Trade Assurance — trust layer */}
        <section className="rounded-3xl border border-border bg-white p-8 sm:p-10 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center gap-8">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary mb-3">
                <Shield size={14} /> Karm Baba Trade Assurance
              </div>
              <h2 className="font-heading text-2xl font-bold mb-3">Trade with confidence</h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                Borrowing the best of Alibaba Order Protections and IndiaMART’s trusted-platform promise —
                every RFQ can move from quote → accept → delivery confirmation on one timeline.
              </p>
              <div className="grid sm:grid-cols-3 gap-3 text-sm">
                {["Verified supplier badges", "Quote & accept workflow", "Buyer–seller RFQ thread"].map((t) => (
                  <div key={t} className="flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-2">
                    <CheckCircle size={14} className="text-green-600" /> {t}
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={() => navigate("/rfq/new")}
              className="bg-primary text-white px-6 py-3.5 rounded-xl font-semibold hover:bg-primary/90 flex-shrink-0"
            >
              Start an RFQ
            </button>
          </div>
        </section>

        {/* How it works */}
        <section className="bg-gradient-to-br from-slate-50 to-blue-50/40 rounded-3xl p-8 sm:p-12 border border-slate-100">
          <div className="text-center mb-10">
            <h2 className="font-heading text-2xl font-bold text-foreground mb-2">How Karm Baba Works</h2>
            <p className="text-muted-foreground">Source, negotiate and trade — all in one platform</p>
          </div>
          <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-8">
            <div className="hidden sm:block absolute top-10 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-primary/30 via-primary/60 to-primary/30" />
            {[
              { icon: <Search size={26} />, step: "01", title: "Search & Discover", desc: "Browse thousands of products and find verified suppliers that match your requirements across India." },
              { icon: <TrendingUp size={26} />, step: "02", title: "Request Quotes", desc: "Send RFQs to multiple suppliers and compare prices, terms, and delivery timelines instantly." },
              { icon: <Shield size={26} />, step: "03", title: "Trade Safely", desc: "All suppliers are KYC verified. Secure transactions with buyer protection on every order." },
            ].map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center relative"
              >
                <div className="relative inline-block mb-5">
                  <div className="w-20 h-20 bg-white rounded-2xl shadow-md flex items-center justify-center text-primary mx-auto border border-border">
                    {step.icon}
                  </div>
                  <div className="absolute -top-2 -right-2 w-7 h-7 bg-primary rounded-full flex items-center justify-center text-white text-[11px] font-black shadow-sm">
                    {i + 1}
                  </div>
                </div>
                <h3 className="font-heading font-bold text-lg mb-2">{step.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="relative overflow-hidden bg-secondary rounded-2xl sm:rounded-3xl p-6 sm:p-12 text-white text-center">
          <div className="absolute inset-0 hero-pattern pointer-events-none" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/25 rounded-full translate-x-1/4 -translate-y-1/4 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-400/15 rounded-full -translate-x-1/4 translate-y-1/4 blur-3xl pointer-events-none" />
          <div className="relative min-w-0">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 sm:px-4 py-1.5 text-xs sm:text-sm text-white/90 mb-5">
              <Sparkles size={14} className="text-primary shrink-0" /> Verified B2B marketplace
            </div>
            <h2 className="font-heading text-2xl sm:text-3xl font-bold mb-3 text-balance">Ready to Grow Your Business?</h2>
            <p className="text-white/75 mb-8 max-w-xl mx-auto text-base sm:text-lg">Join thousands of buyers and suppliers already trading on Karm Baba.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={() => navigate("/register?mode=buyer")}
                className="bg-primary hover:bg-primary/90 text-white px-6 sm:px-8 py-3.5 rounded-xl font-semibold transition-all hover:shadow-lg hover:shadow-primary/30 flex items-center justify-center gap-2 min-h-11 w-full sm:w-auto"
              >
                Start Buying <ArrowRight size={16} />
              </button>
              <button
                type="button"
                onClick={() => navigate("/register?mode=seller")}
                className="border border-white/30 hover:bg-white/10 text-white px-6 sm:px-8 py-3.5 rounded-xl font-semibold transition-colors min-h-11 w-full sm:w-auto"
              >
                Become a Supplier
              </button>
            </div>
          </div>
        </section>

        {/* Trust badges */}
        <section>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { icon: <Shield size={22} />, title: "Verified Suppliers", desc: "Every supplier is KYC verified", color: "bg-green-50 text-green-600" },
              { icon: <Headphones size={22} />, title: "24/7 Support", desc: "Dedicated buyer support team", color: "bg-blue-50 text-blue-600" },
              { icon: <TrendingUp size={22} />, title: "Best Prices", desc: "Direct from manufacturer pricing", color: "bg-orange-50 text-orange-600" },
              { icon: <CheckCircle size={22} />, title: "Quality Assured", desc: "ISO certified product standards", color: "bg-purple-50 text-purple-600" },
            ].map(item => (
              <div key={item.title} className="flex gap-4 items-start p-5 kb-card hover:shadow-md transition-shadow">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${item.color}`}>
                  {item.icon}
                </div>
                <div>
                  <div className="font-bold text-sm text-foreground">{item.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
