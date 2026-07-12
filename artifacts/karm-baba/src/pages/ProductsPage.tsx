import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { SlidersHorizontal, Search, ChevronLeft, ChevronRight, CheckCircle, Star, X, Package } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useListProducts, useListCategories } from "@workspace/api-client-react";
import { StarRating } from "@/components/StarRating";

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-border overflow-hidden animate-pulse shadow-sm">
      <div className="bg-muted h-44" />
      <div className="p-3.5 space-y-2.5">
        <div className="h-4 bg-muted rounded-full w-3/4" />
        <div className="h-3 bg-muted rounded-full w-1/2" />
        <div className="h-3 bg-muted rounded-full w-1/3" />
      </div>
    </div>
  );
}

function FilterPanel({
  categories,
  categoryId, setCategoryId,
  minPrice, setMinPrice,
  maxPrice, setMaxPrice,
  inputSearch, setInputSearch,
  handleSearchSubmit,
  setPage,
  verifiedOnly, setVerifiedOnly,
  inStockOnly, setInStockOnly,
  sort, setSort,
}: {
  categories: Array<{ id: number; name: string; productCount: number }> | undefined;
  categoryId: number | null;
  setCategoryId: (v: number | null) => void;
  minPrice: string; setMinPrice: (v: string) => void;
  maxPrice: string; setMaxPrice: (v: string) => void;
  inputSearch: string; setInputSearch: (v: string) => void;
  handleSearchSubmit: (e: React.FormEvent) => void;
  setPage: (v: number) => void;
  verifiedOnly: boolean; setVerifiedOnly: (v: boolean) => void;
  inStockOnly: boolean; setInStockOnly: (v: boolean) => void;
  sort: string; setSort: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-border p-4 shadow-sm">
        <h3 className="font-semibold text-sm mb-3 text-foreground">Search</h3>
        <form onSubmit={handleSearchSubmit}>
          <div className="flex gap-2">
            <input
              type="text"
              value={inputSearch}
              onChange={e => setInputSearch(e.target.value)}
              placeholder="Product name..."
              className="flex-1 border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
            />
            <button type="submit" className="bg-primary text-white rounded-xl p-2.5 hover:bg-primary/90 transition-colors flex-shrink-0">
              <Search size={14} />
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-border p-4 shadow-sm">
        <h3 className="font-semibold text-sm mb-3 text-foreground">Sort by</h3>
        <select
          value={sort}
          onChange={e => { setSort(e.target.value); setPage(1); }}
          className="w-full border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary bg-white"
        >
          <option value="newest">Newest</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
          <option value="rating">Top Rated</option>
          <option value="moq">Lowest MOQ</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-border p-4 shadow-sm">
        <h3 className="font-semibold text-sm mb-3 text-foreground">Category</h3>
        <div className="space-y-0.5">
          <button
            onClick={() => { setCategoryId(null); setPage(1); }}
            className={`block w-full text-left text-sm px-3 py-2 rounded-xl transition-colors ${categoryId === null ? "bg-primary text-white font-semibold" : "hover:bg-muted text-foreground"}`}
          >
            All Categories
          </button>
          {categories?.map(cat => (
            <button
              key={cat.id}
              onClick={() => { setCategoryId(cat.id); setPage(1); }}
              className={`flex w-full text-left text-sm px-3 py-2 rounded-xl transition-colors items-center justify-between ${categoryId === cat.id ? "bg-primary text-white font-semibold" : "hover:bg-muted text-foreground"}`}
            >
              <span className="truncate">{cat.name}</span>
              <span className={`text-xs flex-shrink-0 ml-2 ${categoryId === cat.id ? "text-white/70" : "text-muted-foreground"}`}>({cat.productCount})</span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-border p-4 shadow-sm space-y-3">
        <h3 className="font-semibold text-sm text-foreground">Supplier filters</h3>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={verifiedOnly} onChange={e => { setVerifiedOnly(e.target.checked); setPage(1); }} className="rounded border-border" />
          Verified suppliers only
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={inStockOnly} onChange={e => { setInStockOnly(e.target.checked); setPage(1); }} className="rounded border-border" />
          In stock only
        </label>
      </div>

      <div className="bg-white rounded-2xl border border-border p-4 shadow-sm">
        <h3 className="font-semibold text-sm mb-3 text-foreground">Price Range (₹)</h3>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Min"
            value={minPrice}
            onChange={e => { setMinPrice(e.target.value); setPage(1); }}
            className="w-full border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
          />
          <input
            type="number"
            placeholder="Max"
            value={maxPrice}
            onChange={e => { setMaxPrice(e.target.value); setPage(1); }}
            className="w-full border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
          />
        </div>
      </div>
    </div>
  );
}

export function ProductsPage() {
  const [location, navigate] = useLocation();
  const searchParams = new URLSearchParams(location.includes("?") ? location.split("?")[1] : "");

  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [inputSearch, setInputSearch] = useState(searchParams.get("search") ?? "");
  const [categoryId, setCategoryId] = useState<number | null>(searchParams.get("categoryId") ? Number(searchParams.get("categoryId")) : null);
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [page, setPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState("newest");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSearch(params.get("search") ?? "");
    setInputSearch(params.get("search") ?? "");
    setCategoryId(params.get("categoryId") ? Number(params.get("categoryId")) : null);
    setPage(1);
  }, [location]);

  // Close filter drawer when switching to desktop
  useEffect(() => {
    const handler = () => { if (window.innerWidth >= 768) setFilterOpen(false); };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const { data: categories } = useListCategories();
  const { data, isLoading } = useListProducts({
    search: search || undefined,
    categoryId: categoryId ?? undefined,
    minPrice: minPrice ? Number(minPrice) : undefined,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
    page,
    limit: 20,
    // Extra filters supported by API (cast — OpenAPI client types lag behind)
    ...( {
      verifiedOnly: verifiedOnly ? true : undefined,
      inStock: inStockOnly ? true : undefined,
      sort,
    } as any),
  });

  const totalPages = data ? Math.ceil(data.total / 20) : 1;
  const hasFilters = search || categoryId || minPrice || maxPrice || verifiedOnly || inStockOnly || sort !== "newest";

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSearch(inputSearch);
    setPage(1);
  }

  function clearFilters() {
    setSearch(""); setInputSearch(""); setCategoryId(null); setMinPrice(""); setMaxPrice("");
    setVerifiedOnly(false); setInStockOnly(false); setSort("newest"); setPage(1);
  }

  const selectedCategory = categories?.find(c => c.id === categoryId);

  const filterProps = {
    categories, categoryId, setCategoryId, minPrice, setMinPrice, maxPrice, setMaxPrice,
    inputSearch, setInputSearch, handleSearchSubmit, setPage,
    verifiedOnly, setVerifiedOnly, inStockOnly, setInStockOnly, sort, setSort,
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
      {/* Mobile filter drawer */}
      <AnimatePresence>
        {filterOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
              onClick={() => setFilterOpen(false)}
            />
            <motion.div
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.25 }}
              className="fixed left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-background z-50 overflow-y-auto p-4 md:hidden shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="font-heading font-bold text-base">Filters</span>
                <button onClick={() => setFilterOpen(false)} className="w-8 h-8 rounded-xl hover:bg-muted flex items-center justify-center transition-colors">
                  <X size={18} />
                </button>
              </div>
              <FilterPanel {...filterProps} />
              <button
                onClick={() => { clearFilters(); setFilterOpen(false); }}
                className="mt-4 w-full py-2.5 border border-border rounded-xl text-sm font-semibold text-muted-foreground hover:text-destructive hover:border-destructive transition-colors"
              >
                Clear All Filters
              </button>
              <button
                onClick={() => setFilterOpen(false)}
                className="mt-2 w-full py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                Apply Filters
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-3">
        <div className="min-w-0">
          <h1 className="font-heading text-xl sm:text-2xl font-bold text-foreground truncate">
            {selectedCategory ? selectedCategory.name : search ? `"${search}"` : "All Products"}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {data ? `${data.total.toLocaleString()} products found` : "Loading..."}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive border border-border rounded-xl px-3 py-2 transition-colors"
            >
              <X size={14} /> <span className="hidden sm:inline">Clear</span>
            </button>
          )}
          <button
            onClick={() => setFilterOpen(true)}
            className="md:hidden flex items-center gap-2 bg-white border border-border px-3 py-2 rounded-xl text-sm font-medium hover:bg-muted transition-colors shadow-sm"
          >
            <SlidersHorizontal size={15} /> Filters
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Desktop sidebar */}
        <aside className="hidden md:block w-56 flex-shrink-0">
          <FilterPanel {...filterProps} />
        </aside>

        {/* Product grid */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : data?.items.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-border">
              <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Package size={28} className="text-muted-foreground" />
              </div>
              <h3 className="text-lg font-heading font-bold text-foreground mb-2">No products found</h3>
              <p className="text-muted-foreground text-sm mb-6">Try adjusting your search or filters</p>
              <button onClick={clearFilters} className="bg-primary text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors">
                Clear Filters
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {data?.items.map((product, i) => (
                  <motion.button
                    key={product.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.3) }}
                    onClick={() => navigate(`/products/${product.id}`)}
                    className="bg-white rounded-2xl border border-border overflow-hidden hover:border-primary/30 transition-all text-left group shadow-sm card-hover"
                  >
                    <div className="relative h-36 sm:h-44 overflow-hidden bg-muted">
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                      {product.inStock === false && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
                          <span className="bg-white/90 text-foreground text-xs font-bold px-2 py-1 rounded-lg">Out of Stock</span>
                        </div>
                      )}
                      {product.inStock !== false && i % 5 === 0 && (
                        <div className="absolute top-2 left-2 bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 pointer-events-none">
                          <Star size={9} className="fill-white" /> HOT
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                      <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0 pointer-events-none">
                        <span className="bg-white text-primary text-[10px] font-bold px-2 py-1 rounded-full shadow-lg w-full inline-block text-center">
                          Get Quote →
                        </span>
                      </div>
                    </div>
                    <div className="p-3 sm:p-3.5">
                      <h3 className="text-xs sm:text-sm font-semibold text-foreground line-clamp-2 leading-tight mb-1.5 sm:mb-2">{product.name}</h3>
                      <div className="flex items-baseline gap-1 mb-1">
                        <span className="text-primary font-bold text-xs sm:text-sm">₹{product.minPrice}–{product.maxPrice}</span>
                        <span className="text-xs text-muted-foreground hidden sm:inline">/{product.unit}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mb-1 sm:mb-2 hidden sm:block">MOQ: {product.minOrder} {product.unit}</div>
                      {product.rating && <div className="hidden sm:block"><StarRating rating={product.rating} reviewCount={product.reviewCount} size={11} /></div>}
                      <div className="mt-1 sm:mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                        {product.supplierVerified && <CheckCircle size={11} className="text-green-500 flex-shrink-0" />}
                        <span className="truncate">{product.supplierName}</span>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-10">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="flex items-center gap-1.5 px-3 sm:px-4 py-2 border border-border rounded-xl disabled:opacity-40 hover:bg-muted transition-colors text-sm font-medium"
                  >
                    <ChevronLeft size={15} /> <span className="hidden sm:inline">Prev</span>
                  </button>
                  <div className="flex gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const p = i + 1;
                      return (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={`w-9 h-9 rounded-xl text-sm font-semibold transition-colors ${page === p ? "bg-primary text-white" : "border border-border hover:bg-muted"}`}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="flex items-center gap-1.5 px-3 sm:px-4 py-2 border border-border rounded-xl disabled:opacity-40 hover:bg-muted transition-colors text-sm font-medium"
                  >
                    <span className="hidden sm:inline">Next</span> <ChevronRight size={15} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
