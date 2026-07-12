import { useState } from "react";
import { useLocation } from "wouter";
import { Search, Shield, TrendingUp, Headphones, ArrowRight, CheckCircle, Package, Cpu, Shirt, Leaf, Wrench, Zap, Home, Car, Activity, Star, BadgeCheck, Sparkles, Globe, Users } from "lucide-react";
import { motion } from "framer-motion";
import { useGetFeaturedProducts, useGetFeaturedSuppliers, useListCategories, useGetDashboardStats, useListProducts, useListSuppliers } from "@workspace/api-client-react";
import { StarRating } from "@/components/StarRating";

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
    <div className="bg-white rounded-2xl border border-border overflow-hidden animate-pulse shadow-sm">
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

  const { data: featuredProducts, isLoading: loadingProducts } = useGetFeaturedProducts();
  const { data: featuredSuppliers, isLoading: loadingSuppliers } = useGetFeaturedSuppliers();
  const { data: catalog } = useListProducts({ limit: 8, page: 1, sort: "rating" } as any);
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
      <section className="relative overflow-hidden bg-secondary hero-pattern text-white">
        {/* Decorative blobs */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-400/10 rounded-full translate-y-1/2 -translate-x-1/3 blur-3xl pointer-events-none" />

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
            <div className="flex items-center bg-white rounded-2xl overflow-hidden shadow-2xl ring-4 ring-white/20">
              <Search size={20} className="ml-5 text-muted-foreground flex-shrink-0" />
              <input
                type="text"
                placeholder="Search products, suppliers, categories..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="flex-1 px-4 py-4 text-foreground outline-none text-base placeholder:text-muted-foreground"
              />
              <button
                type="submit"
                className="bg-primary hover:bg-primary/90 text-white px-6 py-4 font-semibold text-base transition-all flex-shrink-0 flex items-center gap-2 rounded-r-2xl"
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
                className="bg-white/10 hover:bg-white/20 text-white/90 px-3 py-1 rounded-full transition-colors border border-white/15 hover:border-white/30"
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
              { icon: <Users size={16} className="text-amber-400" />, text: "Free Registration" },
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
              { label: "Registered Buyers", value: stats.totalUsers, icon: <Users size={20} />, color: "text-purple-500 bg-purple-50" },
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

      <div className="max-w-7xl mx-auto px-4 py-12 space-y-16">

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
              : products.map((product, i) => (
                <motion.button
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  onClick={() => navigate(`/products/${product.id}`)}
                  className="bg-white rounded-2xl border border-border overflow-hidden hover:border-primary/30 transition-all text-left group shadow-sm card-hover"
                >
                  <div className="relative h-40 overflow-hidden bg-muted">
                    <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    {i < 2 && (
                      <div className="absolute top-2 left-2 bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Star size={9} className="fill-white" /> HOT
                      </div>
                    )}
                    {(product as { supplierVerified?: boolean }).supplierVerified && (
                      <div className="absolute top-2 right-2 bg-white/95 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle size={9} /> Verified
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                      <span className="bg-white text-primary text-[10px] font-bold px-2.5 py-1 rounded-full shadow-lg w-full inline-block text-center">
                        Get Best Price →
                      </span>
                    </div>
                  </div>
                  <div className="p-3">
                    <h3 className="text-xs font-semibold text-foreground line-clamp-2 leading-tight mb-1.5">{product.name}</h3>
                    <div className="text-primary font-bold text-sm">₹{product.minPrice}–{product.maxPrice}</div>
                    <div className="text-[11px] text-muted-foreground">per {product.unit} · MOQ {product.minOrder}</div>
                    {product.rating && <div className="mt-1.5"><StarRating rating={product.rating} size={10} /></div>}
                    {product.supplierName && (
                      <div className="mt-1.5 text-[11px] text-muted-foreground truncate">{product.supplierName}</div>
                    )}
                  </div>
                </motion.button>
              ))}
          </div>
          {!loadingProducts && products.length === 0 && (
            <div className="text-center py-10 text-sm text-muted-foreground border border-dashed border-border rounded-2xl">
              No featured products yet.{" "}
              <button className="text-primary font-semibold" onClick={() => navigate("/products")}>Browse catalog →</button>
            </div>
          )}
        </section>

        {/* Featured Suppliers */}
        <section>
          <div className="flex items-center justify-between mb-7">
            <div>
              <h2 className="font-heading text-2xl font-bold text-foreground">Top Verified Suppliers</h2>
              <p className="text-muted-foreground text-sm mt-1">
                KYC-checked manufacturers with strong response rates — like IndiaMART’s trusted sellers
              </p>
            </div>
            <button onClick={() => navigate("/suppliers?verified=true")} className="text-primary text-sm font-semibold flex items-center gap-1.5 hover:gap-2.5 transition-all group">
              View All <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {loadingSuppliers && suppliers.length === 0
              ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-border p-5 animate-pulse">
                  <div className="flex gap-3 mb-4">
                    <div className="w-14 h-14 bg-muted rounded-2xl flex-shrink-0" />
                    <div className="flex-1 space-y-2 pt-1">
                      <div className="h-4 bg-muted rounded-full w-3/4" />
                      <div className="h-3 bg-muted rounded-full w-1/2" />
                    </div>
                  </div>
                  <div className="h-3 bg-muted rounded-full w-full mb-2" />
                  <div className="h-3 bg-muted rounded-full w-2/3" />
                </div>
              ))
              : suppliers.map((supplier, i) => (
                <motion.button
                  key={supplier.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  onClick={() => navigate(`/suppliers/${supplier.id}`)}
                  className="bg-white rounded-2xl border border-border p-5 hover:border-primary/30 transition-all text-left group shadow-sm card-hover"
                >
                  <div className="flex items-start gap-3 mb-4">
                    {supplier.logoUrl ? (
                      <img src={supplier.logoUrl} alt={supplier.companyName} className="w-14 h-14 rounded-2xl object-cover flex-shrink-0 border border-border" />
                    ) : (
                      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${categoryGradients[i % categoryGradients.length]} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                        <span className="text-xl font-bold text-white">{supplier.companyName[0]}</span>
                      </div>
                    )}
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-bold text-sm text-foreground truncate">{supplier.companyName}</h3>
                      </div>
                      {supplier.verified && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full mt-1">
                          <CheckCircle size={9} /> Verified
                        </span>
                      )}
                      <div className="text-xs text-muted-foreground mt-1 truncate">{supplier.location}</div>
                    </div>
                  </div>
                  <StarRating rating={supplier.rating} reviewCount={supplier.reviewCount} />
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-medium">{supplier.productCount} products</span>
                    <span>{supplier.yearsInBusiness}yr in business</span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                    <span className="text-xs font-semibold text-primary group-hover:underline flex items-center gap-1">
                      View Profile <ArrowRight size={11} />
                    </span>
                    <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                      Get Best Price
                    </span>
                  </div>
                </motion.button>
              ))}
          </div>
          {!loadingSuppliers && suppliers.length === 0 && (
            <div className="text-center py-10 text-sm text-muted-foreground border border-dashed border-border rounded-2xl">
              No suppliers yet.{" "}
              <button className="text-primary font-semibold" onClick={() => navigate("/suppliers")}>Browse directory →</button>
            </div>
          )}
        </section>

        {/* Marketplace shortcuts — Alibaba / IndiaMART inspired */}
        <section className="grid sm:grid-cols-3 gap-4">
          {[
            {
              title: "Get Best Price",
              desc: "Post your requirement once — suppliers compete with quotes.",
              cta: "Post RFQ",
              path: "/rfq/new",
              tone: "bg-orange-50 border-orange-100 text-orange-900",
            },
            {
              title: "Verified Manufacturers",
              desc: "Source only from KYC-checked suppliers with ratings.",
              cta: "Browse suppliers",
              path: "/suppliers?verified=true",
              tone: "bg-green-50 border-green-100 text-green-900",
            },
            {
              title: "Top Ranking Products",
              desc: "Discover featured wholesale picks trending this week.",
              cta: "View products",
              path: "/products",
              tone: "bg-blue-50 border-blue-100 text-blue-900",
            },
          ].map((card) => (
            <button
              key={card.title}
              onClick={() => navigate(card.path)}
              className={`text-left rounded-2xl border p-5 hover:shadow-md transition-all ${card.tone}`}
            >
              <h3 className="font-heading font-bold text-lg mb-1">{card.title}</h3>
              <p className="text-sm opacity-80 mb-3">{card.desc}</p>
              <span className="text-sm font-semibold inline-flex items-center gap-1">
                {card.cta} <ArrowRight size={14} />
              </span>
            </button>
          ))}
        </section>

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
        <section className="relative overflow-hidden bg-secondary rounded-3xl p-8 sm:p-12 text-white text-center">
          <div className="absolute inset-0 hero-pattern pointer-events-none" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/25 rounded-full translate-x-1/4 -translate-y-1/4 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-400/15 rounded-full -translate-x-1/4 translate-y-1/4 blur-3xl pointer-events-none" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-sm text-white/90 mb-5">
              <Sparkles size={14} className="text-primary" /> Free to join — No listing fees
            </div>
            <h2 className="font-heading text-3xl font-bold mb-3">Ready to Grow Your Business?</h2>
            <p className="text-white/75 mb-8 max-w-xl mx-auto text-lg">Join thousands of buyers and suppliers already trading on Karm Baba.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => navigate("/register")}
                className="bg-primary hover:bg-primary/90 text-white px-8 py-3.5 rounded-xl font-semibold transition-all hover:shadow-lg hover:shadow-primary/30 flex items-center justify-center gap-2"
              >
                Start Buying Free <ArrowRight size={16} />
              </button>
              <button
                onClick={() => navigate("/register")}
                className="border border-white/30 hover:bg-white/10 text-white px-8 py-3.5 rounded-xl font-semibold transition-colors"
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
              <div key={item.title} className="flex gap-4 items-start p-5 bg-white rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow">
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
