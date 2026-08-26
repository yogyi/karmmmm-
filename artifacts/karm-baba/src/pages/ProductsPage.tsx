import { useState, useEffect, useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import { SlidersHorizontal, Search, ChevronLeft, ChevronRight, CheckCircle, Star, X, Package, Leaf } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useListProducts, useListCategories } from "@workspace/api-client-react";
import { StarRating } from "@/components/StarRating";
import { ProductImage } from "@/components/ProductImage";
import { PageHero } from "@/components/PageHero";

function SkeletonCard() {
  return (
    <div className="rounded-2xl overflow-hidden animate-pulse border border-secondary/10 bg-gradient-to-b from-white to-slate-50 shadow-[0_12px_28px_-18px_rgba(26,39,68,0.35)]">
      <div className="bg-slate-200/80 h-44" />
      <div className="p-3.5 space-y-2.5">
        <div className="h-4 bg-slate-200/80 rounded-full w-3/4" />
        <div className="h-3 bg-slate-200/70 rounded-full w-1/2" />
        <div className="h-3 bg-slate-200/60 rounded-full w-1/3" />
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
  onApplyPrice,
  verifiedOnly, setVerifiedOnly,
  inStockOnly, setInStockOnly,
  sort, setSort,
  resultTotal,
  loadingResults,
}: {
  categories: Array<{ id: number; name: string; productCount: number }> | undefined;
  categoryId: number | null;
  setCategoryId: (v: number | null) => void;
  minPrice: string; setMinPrice: (v: string) => void;
  maxPrice: string; setMaxPrice: (v: string) => void;
  inputSearch: string; setInputSearch: (v: string) => void;
  handleSearchSubmit: (e: React.FormEvent) => void;
  onApplyPrice: () => void;
  verifiedOnly: boolean; setVerifiedOnly: (v: boolean) => void;
  inStockOnly: boolean; setInStockOnly: (v: boolean) => void;
  sort: string; setSort: (v: string) => void;
  resultTotal: number | null;
  loadingResults?: boolean;
}) {
  const totalListed =
    categories?.reduce((sum, c) => sum + (c.productCount || 0), 0) ?? 0;

  return (
    <aside className="rounded-2xl overflow-hidden border border-secondary/10 bg-white shadow-[0_12px_32px_-18px_rgba(26,39,68,0.32)]">
      <div className="px-4 py-3.5 border-b border-secondary/10 bg-slate-50/90 flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-secondary/50 font-semibold">
            Refine
          </p>
          <h2 className="font-heading font-bold text-sm text-secondary">Filters</h2>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
            Results
          </p>
          <p className="text-sm font-bold text-primary tabular-nums">
            {loadingResults ? "…" : resultTotal != null ? resultTotal.toLocaleString() : "—"}
          </p>
        </div>
      </div>

      <div className="divide-y divide-secondary/10">
        <div className="p-4">
          <h3 className="font-semibold text-xs uppercase tracking-wide text-secondary/60 mb-2.5">
            Search
          </h3>
          <form onSubmit={handleSearchSubmit}>
            <div className="flex gap-2">
              <input
                type="search"
                value={inputSearch}
                onChange={(e) => setInputSearch(e.target.value)}
                placeholder="Product name…"
                className="kb-field flex-1 !py-2"
                aria-label="Search products"
              />
              <button
                type="submit"
                className="kb-btn-primary p-2.5 flex-shrink-0 min-w-10 inline-flex items-center justify-center"
                aria-label="Search"
              >
                <Search size={14} />
              </button>
            </div>
          </form>
        </div>

        <div className="p-4">
          <h3 className="font-semibold text-xs uppercase tracking-wide text-secondary/60 mb-2.5">
            Sort by
          </h3>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="kb-field !py-2"
            aria-label="Sort products"
          >
            <option value="newest">Newest</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="rating">Top Rated</option>
            <option value="moq">Lowest MOQ</option>
          </select>
        </div>

        <div className="p-4">
          <h3 className="font-semibold text-xs uppercase tracking-wide text-secondary/60 mb-2.5">
            Category
          </h3>
          <div className="space-y-0.5 max-h-56 overflow-y-auto scrollbar-none pr-0.5">
            <button
              type="button"
              onClick={() => setCategoryId(null)}
              className={`flex w-full text-left text-sm px-3 py-2 rounded-xl transition-colors items-center justify-between ${
                categoryId === null
                  ? "bg-secondary text-white font-semibold shadow-sm"
                  : "hover:bg-slate-100 text-foreground"
              }`}
            >
              <span>All Categories</span>
              <span
                className={`text-xs flex-shrink-0 ml-2 tabular-nums ${
                  categoryId === null ? "text-white/75" : "text-muted-foreground"
                }`}
              >
                ({totalListed})
              </span>
            </button>
            {categories?.map((cat) => {
              const active = categoryId === cat.id;
              return (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => setCategoryId(cat.id)}
                  className={`flex w-full text-left text-sm px-3 py-2 rounded-xl transition-colors items-center justify-between ${
                    active
                      ? "bg-primary text-white font-semibold shadow-[0_8px_18px_-10px_rgba(255,122,0,0.85)]"
                      : "hover:bg-slate-100 text-foreground"
                  }`}
                >
                  <span className="truncate">{cat.name}</span>
                  <span
                    className={`text-xs flex-shrink-0 ml-2 tabular-nums ${
                      active ? "text-white/75" : "text-muted-foreground"
                    }`}
                  >
                    ({cat.productCount})
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-4 space-y-2">
          <h3 className="font-semibold text-xs uppercase tracking-wide text-secondary/60 mb-1">
            Supplier filters
          </h3>
          <label className="flex items-center gap-2.5 text-sm cursor-pointer rounded-xl px-2.5 py-2 hover:bg-slate-50">
            <input
              type="checkbox"
              checked={verifiedOnly}
              onChange={(e) => setVerifiedOnly(e.target.checked)}
              className="rounded border-border accent-primary h-4 w-4"
            />
            Verified suppliers only
          </label>
          <label className="flex items-center gap-2.5 text-sm cursor-pointer rounded-xl px-2.5 py-2 hover:bg-slate-50">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) => setInStockOnly(e.target.checked)}
              className="rounded border-border accent-primary h-4 w-4"
            />
            In stock only
          </label>
        </div>

        <div className="p-4">
          <h3 className="font-semibold text-xs uppercase tracking-wide text-secondary/60 mb-2.5">
            Price range (₹)
          </h3>
          <div className="flex gap-2 mb-2.5">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="Min"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onApplyPrice();
                }
              }}
              className="kb-field !py-2"
              aria-label="Minimum price"
            />
            <input
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="Max"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onApplyPrice();
                }
              }}
              className="kb-field !py-2"
              aria-label="Maximum price"
            />
          </div>
          <button
            type="button"
            onClick={onApplyPrice}
            className="w-full min-h-10 rounded-xl border border-secondary/15 bg-slate-50 text-sm font-semibold text-secondary hover:bg-secondary hover:text-white transition-colors"
          >
            Apply price filter
          </button>
        </div>
      </div>
    </aside>
  );
}

export function ProductsPage() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(
    searchString.startsWith("?") ? searchString.slice(1) : searchString,
  );

  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [inputSearch, setInputSearch] = useState(searchParams.get("search") ?? "");
  const [categoryId, setCategoryId] = useState<number | null>(
    searchParams.get("categoryId") ? Number(searchParams.get("categoryId")) : null,
  );
  const [minPrice, setMinPrice] = useState(searchParams.get("minPrice") ?? "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("maxPrice") ?? "");
  const [page, setPage] = useState(
    Math.max(1, Number(searchParams.get("page") || "1") || 1),
  );
  const [filterOpen, setFilterOpen] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(
    searchParams.get("verified") === "true",
  );
  const [inStockOnly, setInStockOnly] = useState(searchParams.get("inStock") === "true");
  const [sort, setSort] = useState(searchParams.get("sort") ?? "newest");
  const [supplierId, setSupplierId] = useState<number | null>(
    searchParams.get("supplierId") ? Number(searchParams.get("supplierId")) : null,
  );

  const writeQuery = useCallback(
    (patch: {
      search?: string;
      categoryId?: number | null;
      minPrice?: string;
      maxPrice?: string;
      page?: number;
      sort?: string;
      verifiedOnly?: boolean;
      inStockOnly?: boolean;
      supplierId?: number | null;
    }) => {
      const next = {
        search: patch.search !== undefined ? patch.search : search,
        categoryId: patch.categoryId !== undefined ? patch.categoryId : categoryId,
        minPrice: patch.minPrice !== undefined ? patch.minPrice : minPrice,
        maxPrice: patch.maxPrice !== undefined ? patch.maxPrice : maxPrice,
        page: patch.page !== undefined ? patch.page : page,
        sort: patch.sort !== undefined ? patch.sort : sort,
        verifiedOnly:
          patch.verifiedOnly !== undefined ? patch.verifiedOnly : verifiedOnly,
        inStockOnly: patch.inStockOnly !== undefined ? patch.inStockOnly : inStockOnly,
        supplierId: patch.supplierId !== undefined ? patch.supplierId : supplierId,
      };
      const params = new URLSearchParams();
      if (next.search.trim()) params.set("search", next.search.trim());
      if (next.categoryId != null) params.set("categoryId", String(next.categoryId));
      if (next.supplierId != null) params.set("supplierId", String(next.supplierId));
      if (next.minPrice) params.set("minPrice", next.minPrice);
      if (next.maxPrice) params.set("maxPrice", next.maxPrice);
      if (next.page > 1) params.set("page", String(next.page));
      if (next.sort && next.sort !== "newest") params.set("sort", next.sort);
      if (next.verifiedOnly) params.set("verified", "true");
      if (next.inStockOnly) params.set("inStock", "true");
      const qs = params.toString();
      navigate(qs ? `/products?${qs}` : "/products");
    },
    [
      navigate,
      search,
      categoryId,
      minPrice,
      maxPrice,
      page,
      sort,
      verifiedOnly,
      inStockOnly,
      supplierId,
    ],
  );

  // Keep filters in sync when header nav changes query (same /products path).
  useEffect(() => {
    const params = new URLSearchParams(
      searchString.startsWith("?") ? searchString.slice(1) : searchString,
    );
    setSearch(params.get("search") ?? "");
    setInputSearch(params.get("search") ?? "");
    setCategoryId(params.get("categoryId") ? Number(params.get("categoryId")) : null);
    setSupplierId(params.get("supplierId") ? Number(params.get("supplierId")) : null);
    setMinPrice(params.get("minPrice") ?? "");
    setMaxPrice(params.get("maxPrice") ?? "");
    setPage(Math.max(1, Number(params.get("page") || "1") || 1));
    setSort(params.get("sort") ?? "newest");
    setVerifiedOnly(params.get("verified") === "true");
    setInStockOnly(params.get("inStock") === "true");
  }, [searchString]);

  const applyCategory = useCallback(
    (id: number | null) => {
      setCategoryId(id);
      setPage(1);
      writeQuery({ categoryId: id, page: 1 });
    },
    [writeQuery],
  );

  // Close filter drawer when switching to desktop
  useEffect(() => {
    const handler = () => { if (window.innerWidth >= 768) setFilterOpen(false); };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // Close filter drawer on Escape
  useEffect(() => {
    if (!filterOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setFilterOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [filterOpen]);

  const { data: categories } = useListCategories();
  const {
    data,
    isLoading,
    isError: productsError,
    refetch: refetchProducts,
    isFetching,
  } = useListProducts({
    search: search || undefined,
    categoryId: categoryId ?? undefined,
    supplierId: supplierId ?? undefined,
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
  const hasFilters =
    search ||
    categoryId ||
    supplierId ||
    minPrice ||
    maxPrice ||
    verifiedOnly ||
    inStockOnly ||
    sort !== "newest";

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = inputSearch.trim();
    setSearch(q);
    setPage(1);
    writeQuery({ search: q, page: 1 });
  }

  function applyPriceFilter() {
    setPage(1);
    writeQuery({ minPrice, maxPrice, page: 1 });
  }

  function clearFilters() {
    setSearch("");
    setInputSearch("");
    setCategoryId(null);
    setSupplierId(null);
    setMinPrice("");
    setMaxPrice("");
    setVerifiedOnly(false);
    setInStockOnly(false);
    setSort("newest");
    setPage(1);
    navigate("/products");
  }

  const goToPage = useCallback(
    (p: number) => {
      setPage(p);
      writeQuery({ page: p });
    },
    [writeQuery],
  );

  const selectedCategory = categories?.find((c) => c.id === categoryId);

  const filterProps = {
    categories,
    categoryId,
    setCategoryId: applyCategory,
    minPrice,
    setMinPrice: (v: string) => setMinPrice(v),
    maxPrice,
    setMaxPrice: (v: string) => setMaxPrice(v),
    inputSearch,
    setInputSearch,
    handleSearchSubmit,
    onApplyPrice: applyPriceFilter,
    verifiedOnly,
    setVerifiedOnly: (v: boolean) => {
      setVerifiedOnly(v);
      writeQuery({ verifiedOnly: v, page: 1 });
    },
    inStockOnly,
    setInStockOnly: (v: boolean) => {
      setInStockOnly(v);
      writeQuery({ inStockOnly: v, page: 1 });
    },
    sort,
    setSort: (v: string) => {
      setSort(v);
      writeQuery({ sort: v, page: 1 });
    },
    resultTotal: data?.total ?? null,
    loadingResults: isLoading || isFetching,
  };

  const pageTitle = selectedCategory
    ? selectedCategory.name
    : supplierId
      ? "Supplier catalog"
      : search
        ? `"${search}"`
        : "All Products";

  const pageCountLabel = productsError
    ? "Could not load products"
    : data
      ? `${data.total.toLocaleString()} products found`
      : "Loading…";

  return (
    <div>
      <PageHero
        compact
        eyebrow="Marketplace · Catalog"
        title={
          <span className="inline-flex items-center gap-2.5">
            {selectedCategory?.name === "Agriculture" ? (
              <Leaf size={26} className="text-primary shrink-0" />
            ) : null}
            {pageTitle}
          </span>
        }
        description={
          <>
            {pageCountLabel}
            {supplierId != null && !productsError ? ` · supplier #${supplierId}` : ""}
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            {hasFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center justify-center gap-1.5 text-sm font-semibold bg-white/10 hover:bg-white/15 border border-white/25 px-3 py-2.5 rounded-xl min-h-11 flex-1 sm:flex-none"
              >
                <X size={14} className="shrink-0" />
                <span className="truncate">Clear filters</span>
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setFilterOpen(true)}
              className="md:hidden inline-flex items-center justify-center gap-2 kb-btn-primary px-3 py-2.5 text-sm min-h-11 flex-1 sm:flex-none"
            >
              <SlidersHorizontal size={15} className="shrink-0" /> Filters
            </button>
          </div>
        }
      />

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8 min-w-0">
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
              className="fixed left-0 top-0 bottom-0 w-80 max-w-[85vw] z-50 overflow-y-auto p-3 md:hidden shadow-2xl bg-gradient-to-b from-[#f8f5f0] to-[#eef1f6]"
            >
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="font-heading font-bold text-base text-secondary">Filters</span>
                <button
                  type="button"
                  aria-label="Close filters"
                  onClick={() => setFilterOpen(false)}
                  className="min-w-11 min-h-11 rounded-xl hover:bg-white/80 flex items-center justify-center transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              <FilterPanel {...filterProps} />
              <button
                type="button"
                onClick={() => { clearFilters(); setFilterOpen(false); }}
                className="mt-4 w-full py-2.5 border border-border rounded-xl text-sm font-semibold text-muted-foreground hover:text-destructive hover:border-destructive transition-colors bg-white"
              >
                Clear All Filters
              </button>
              <button
                type="button"
                onClick={() => {
                  const q = inputSearch.trim();
                  setSearch(q);
                  setPage(1);
                  writeQuery({ search: q, minPrice, maxPrice, page: 1 });
                  setFilterOpen(false);
                }}
                className="mt-2 w-full py-2.5 kb-btn-primary text-sm"
              >
                Apply Filters
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex gap-5 lg:gap-7">
        {/* Desktop sidebar */}
        <div className="hidden md:block w-60 lg:w-64 flex-shrink-0 sticky top-24 self-start">
          <FilterPanel {...filterProps} />
        </div>

        {/* Product grid */}
        <div className="flex-1 min-w-0">
          {supplierId != null && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/20 bg-accent/70 px-3.5 py-2.5 text-sm">
              <span className="text-secondary/80">
                Showing products for this supplier only
              </span>
              <button
                type="button"
                onClick={() => {
                  setSupplierId(null);
                  writeQuery({ supplierId: null, page: 1 });
                }}
                className="text-primary font-semibold hover:underline"
              >
                Clear supplier filter
              </button>
            </div>
          )}
          {productsError ? (
            <div className="text-center py-20 rounded-2xl border border-secondary/10 bg-gradient-to-b from-white to-slate-50 shadow-[0_16px_40px_-22px_rgba(26,39,68,0.4)]">
              <h3 className="text-lg font-heading font-bold text-secondary mb-2">
                Couldn’t load products
              </h3>
              <p className="text-muted-foreground text-sm mb-6">
                Check your connection and try again.
              </p>
              <button
                type="button"
                onClick={() => void refetchProducts()}
                disabled={isFetching}
                className="kb-btn-primary px-6 py-2.5 text-sm disabled:opacity-60"
              >
                {isFetching ? "Retrying…" : "Retry"}
              </button>
            </div>
          ) : isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : data?.items.length === 0 ? (
            <div className="text-center py-20 rounded-2xl border border-secondary/10 bg-gradient-to-b from-white to-slate-50 shadow-[0_16px_40px_-22px_rgba(26,39,68,0.4)]">
              <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary/15">
                <Package size={28} className="text-primary" />
              </div>
              <h3 className="text-lg font-heading font-bold text-secondary mb-2">No products found</h3>
              <p className="text-muted-foreground text-sm mb-6">Try adjusting your search or filters</p>
              <button type="button" onClick={clearFilters} className="kb-btn-primary px-6 py-2.5 text-sm">
                Clear Filters
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {data?.items.map((product, i) => (
                  <motion.div
                    key={product.id}
                    role="link"
                    tabIndex={0}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.3) }}
                    onClick={() => navigate(`/products/${product.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate(`/products/${product.id}`);
                      }
                    }}
                    className="group text-left rounded-2xl overflow-hidden border border-secondary/10 bg-white shadow-[0_12px_28px_-18px_rgba(26,39,68,0.4)] hover:border-primary/35 hover:shadow-[0_18px_36px_-14px_rgba(255,122,0,0.4)] hover:-translate-y-0.5 transition-all duration-200 cursor-pointer p-0 m-0"
                  >
                    <div className="kb-product-media h-36 sm:h-44 w-full">
                      <ProductImage
                        src={product.imageUrl}
                        alt={product.name}
                        className="group-hover:scale-[1.04] transition-transform duration-500 ease-out"
                      />
                      {product.inStock === false && (
                        <div className="absolute inset-0 z-[2] bg-secondary/55 flex items-center justify-center pointer-events-none">
                          <span className="bg-white text-secondary text-xs font-bold px-2.5 py-1 rounded-lg shadow-sm">Out of Stock</span>
                        </div>
                      )}
                      {product.inStock !== false &&
                        product.rating != null &&
                        product.rating >= 4.5 && (
                        <div className="absolute top-2.5 left-2.5 z-[2] bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 pointer-events-none shadow-md">
                          <Star size={9} className="fill-white" /> Top rated
                        </div>
                      )}
                      {/* Desktop hover CTA — centered, not a bottom-stretched pill */}
                      <div className="absolute inset-0 z-[1] hidden md:flex items-center justify-center pointer-events-none bg-secondary/0 opacity-0 transition-all duration-300 group-hover:bg-secondary/50 group-hover:opacity-100">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary text-white text-[11px] font-semibold tracking-wide px-4 py-2 shadow-[0_10px_28px_-10px_rgba(255,122,0,0.85)] translate-y-2 scale-95 group-hover:translate-y-0 group-hover:scale-100 transition-all duration-300">
                          Request quote
                          <span aria-hidden className="text-white/90">→</span>
                        </span>
                      </div>
                    </div>
                    <div className="p-3 sm:p-3.5 bg-gradient-to-b from-white to-slate-50/90">
                      <h3 className="text-xs sm:text-sm font-semibold text-secondary line-clamp-2 leading-tight mb-1.5 sm:mb-2">{product.name}</h3>
                      <div className="flex items-baseline gap-1 mb-1">
                        <span className="text-primary font-bold text-xs sm:text-sm">₹{product.minPrice}–{product.maxPrice}</span>
                        <span className="text-xs text-muted-foreground hidden sm:inline">/{product.unit}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mb-1 sm:mb-2 hidden sm:block">MOQ: {product.minOrder} {product.unit}</div>
                      <span className="mt-1.5 mb-1 md:hidden inline-flex items-center justify-center w-full min-h-10 rounded-xl bg-primary text-white text-[11px] font-bold px-2">
                        Get quote →
                      </span>
                      {product.reviewCount > 0 && product.rating != null ? (
                        <div className="hidden sm:block">
                          <StarRating rating={product.rating} reviewCount={product.reviewCount} size={11} />
                        </div>
                      ) : (
                        <div className="hidden sm:block text-[11px] text-muted-foreground mt-0.5">No reviews yet</div>
                      )}
                      <div className="mt-1.5 sm:mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                        {product.supplierVerified && <CheckCircle size={11} className="text-green-500 flex-shrink-0" />}
                        <span className="truncate">{product.supplierName}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-10 flex-wrap">
                  <button
                    type="button"
                    onClick={() => goToPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="flex items-center gap-1.5 px-3 sm:px-4 min-h-11 min-w-11 border border-secondary/15 bg-white rounded-xl disabled:opacity-40 hover:bg-accent transition-colors text-sm font-medium"
                  >
                    <ChevronLeft size={15} /> <span className="hidden sm:inline">Prev</span>
                  </button>
                  <div className="flex gap-1 flex-wrap justify-center">
                    {(() => {
                      const windowSize = 5;
                      let start = Math.max(1, page - Math.floor(windowSize / 2));
                      let end = Math.min(totalPages, start + windowSize - 1);
                      start = Math.max(1, end - windowSize + 1);
                      const pages: number[] = [];
                      for (let p = start; p <= end; p++) pages.push(p);
                      return (
                        <>
                          {start > 1 && (
                            <>
                              <button
                                type="button"
                                onClick={() => goToPage(1)}
                                className="min-w-11 min-h-11 rounded-xl text-sm font-semibold border border-secondary/15 bg-white hover:bg-accent"
                              >
                                1
                              </button>
                              {start > 2 && (
                                <span className="min-w-11 min-h-11 flex items-center justify-center text-muted-foreground text-sm">
                                  …
                                </span>
                              )}
                            </>
                          )}
                          {pages.map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => goToPage(p)}
                              className={`min-w-11 min-h-11 rounded-xl text-sm font-semibold transition-colors ${
                                page === p
                                  ? "kb-btn-primary"
                                  : "border border-secondary/15 bg-white hover:bg-accent"
                              }`}
                            >
                              {p}
                            </button>
                          ))}
                          {end < totalPages && (
                            <>
                              {end < totalPages - 1 && (
                                <span className="min-w-11 min-h-11 flex items-center justify-center text-muted-foreground text-sm">
                                  …
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => goToPage(totalPages)}
                                className="min-w-11 min-h-11 rounded-xl text-sm font-semibold border border-secondary/15 bg-white hover:bg-accent"
                              >
                                {totalPages}
                              </button>
                            </>
                          )}
                        </>
                      );
                    })()}
                  </div>
                  <button
                    type="button"
                    onClick={() => goToPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className="flex items-center gap-1.5 px-3 sm:px-4 min-h-11 min-w-11 border border-secondary/15 bg-white rounded-xl disabled:opacity-40 hover:bg-accent transition-colors text-sm font-medium"
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
    </div>
  );
}
