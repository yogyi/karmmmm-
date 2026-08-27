import { useState, useEffect, useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import { Search, CheckCircle, ChevronLeft, ChevronRight, MapPin, Clock, ArrowRight, Building2 } from "lucide-react";
import { motion } from "framer-motion";
import { useListSuppliers } from "@workspace/api-client-react";
import { StarRating } from "@/components/StarRating";
import {
  formatProductCount,
  formatYearsInBusiness,
} from "@/lib/supplierCardFormat";
import { PageHero } from "@/components/PageHero";

function SkeletonCard() {
  return (
    <div className="rounded-2xl overflow-hidden animate-pulse border border-secondary/10 bg-gradient-to-b from-white to-slate-50 shadow-[0_12px_28px_-18px_rgba(26,39,68,0.35)]">
      <div className="h-[4.5rem] bg-slate-200/80" />
      <div className="p-5 space-y-3">
        <div className="flex gap-3 -mt-8">
          <div className="w-12 h-12 bg-slate-200 rounded-xl border-2 border-white shrink-0" />
          <div className="flex-1 space-y-2 pt-8">
            <div className="h-4 bg-slate-200/80 rounded-full w-3/4" />
            <div className="h-3 bg-slate-200/70 rounded-full w-1/2" />
          </div>
        </div>
        <div className="h-3 bg-slate-200/70 rounded-full w-full" />
        <div className="h-3 bg-slate-200/60 rounded-full w-2/3" />
      </div>
    </div>
  );
}

const avatarGradients = [
  "from-blue-500 to-cyan-400",
  "from-orange-500 to-amber-400",
  "from-green-500 to-emerald-400",
  "from-purple-500 to-violet-400",
  "from-pink-500 to-rose-400",
  "from-indigo-500 to-blue-400",
];

export function SuppliersPage() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const initialParams = new URLSearchParams(
    searchString.startsWith("?") ? searchString.slice(1) : searchString,
  );

  const [search, setSearch] = useState(() => initialParams.get("search") ?? "");
  const [inputSearch, setInputSearch] = useState(() => initialParams.get("search") ?? "");
  const [verified, setVerified] = useState<boolean | null>(() => {
    const v = initialParams.get("verified");
    if (v === "true") return true;
    if (v === "false") return false;
    return null;
  });
  const [page, setPage] = useState(() =>
    Math.max(1, Number(initialParams.get("page") || "1") || 1),
  );

  // Header "Verified Suppliers" uses ?verified=true — sync when query changes.
  useEffect(() => {
    const params = new URLSearchParams(
      searchString.startsWith("?") ? searchString.slice(1) : searchString,
    );
    const v = params.get("verified");
    setVerified(v === "true" ? true : v === "false" ? false : null);
    setSearch(params.get("search") ?? "");
    setInputSearch(params.get("search") ?? "");
    setPage(Math.max(1, Number(params.get("page") || "1") || 1));
  }, [searchString]);

  const writeSuppliersQuery = useCallback(
    (patch: { search?: string; verified?: boolean | null; page?: number }) => {
      const nextSearch = patch.search !== undefined ? patch.search : search;
      const nextVerified = patch.verified !== undefined ? patch.verified : verified;
      const nextPage = patch.page !== undefined ? patch.page : page;
      const params = new URLSearchParams();
      if (nextSearch.trim()) params.set("search", nextSearch.trim());
      if (nextVerified === true) params.set("verified", "true");
      if (nextVerified === false) params.set("verified", "false");
      if (nextPage > 1) params.set("page", String(nextPage));
      const qs = params.toString();
      navigate(qs ? `/suppliers?${qs}` : "/suppliers");
    },
    [navigate, search, verified, page],
  );

  const applyVerified = useCallback(
    (value: boolean | null) => {
      setVerified(value);
      setPage(1);
      writeSuppliersQuery({ verified: value, page: 1 });
    },
    [writeSuppliersQuery],
  );

  const { data, isLoading, isError, refetch, isFetching } = useListSuppliers({
    search: search || undefined,
    verified: verified ?? undefined,
    page,
    limit: 18,
  });

  const totalPages = data ? Math.ceil(data.total / 18) : 1;

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(inputSearch);
    setPage(1);
    writeSuppliersQuery({ search: inputSearch, page: 1 });
  }

  const countLabel = data
    ? verified === true
      ? `${data.total.toLocaleString()} verified suppliers across India`
      : `${data.total.toLocaleString()} suppliers across India`
    : "Loading…";

  return (
    <div>
      <PageHero
        compact
        eyebrow="Marketplace · Directory"
        title={
          <span className="inline-flex items-center gap-2.5">
            <Building2 size={26} className="text-primary shrink-0" />
            {verified === true ? "Verified suppliers" : "Supplier Directory"}
          </span>
        }
        description={countLabel}
      />

      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10 py-6 sm:py-8 min-w-0">
      {/* Search toolbar — clean white with navy/orange accents */}
      <div className="mb-6 rounded-2xl border border-secondary/10 bg-white p-3 sm:p-4 shadow-[0_12px_32px_-18px_rgba(26,39,68,0.35)]">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
          <form onSubmit={handleSearch} className="flex-1 min-w-0">
            <label className="sr-only" htmlFor="supplier-search">
              Search suppliers
            </label>
            <div className="flex items-center rounded-xl border border-secondary/15 bg-slate-50/80 focus-within:bg-white focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15 transition-all">
              <Search size={16} className="ml-3.5 text-secondary/40 shrink-0" aria-hidden />
              <input
                id="supplier-search"
                type="search"
                value={inputSearch}
                onChange={(e) => setInputSearch(e.target.value)}
                placeholder="Search by company, city, or product…"
                className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-sm text-secondary placeholder:text-muted-foreground/70 outline-none"
              />
              <button
                type="submit"
                className="m-1.5 shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-semibold px-3.5 py-2 shadow-[0_8px_18px_-10px_rgba(255,122,0,0.85)] transition-colors"
              >
                <Search size={14} />
                <span className="hidden sm:inline">Search</span>
              </button>
            </div>
          </form>

          <div
            className="flex p-1 rounded-xl bg-slate-100/90 border border-secondary/8 shrink-0 self-stretch lg:self-auto"
            role="group"
            aria-label="Supplier filter"
          >
            <button
              type="button"
              onClick={() => applyVerified(null)}
              className={`flex-1 lg:flex-none px-4 py-2 rounded-lg text-sm font-semibold transition-all min-h-10 ${
                verified === null
                  ? "bg-secondary text-white shadow-sm"
                  : "text-secondary/60 hover:text-secondary hover:bg-white/80"
              }`}
            >
              All suppliers
            </button>
            <button
              type="button"
              onClick={() => applyVerified(true)}
              className={`flex-1 lg:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all min-h-10 ${
                verified === true
                  ? "bg-primary text-white shadow-[0_8px_18px_-10px_rgba(255,122,0,0.75)]"
                  : "text-secondary/60 hover:text-secondary hover:bg-white/80"
              }`}
            >
              <CheckCircle size={14} />
              Verified
            </button>
          </div>
        </div>
      </div>

      {/* Supplier grid */}
      {isError ? (
        <div className="text-center py-20 rounded-2xl border border-secondary/10 bg-gradient-to-b from-white to-slate-50 shadow-[0_16px_40px_-22px_rgba(26,39,68,0.4)]">
          <h3 className="text-lg font-heading font-bold text-secondary mb-2">Couldn’t load suppliers</h3>
          <p className="text-muted-foreground text-sm mb-6">Check your connection and try again.</p>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="kb-btn-primary px-6 py-2.5 text-sm disabled:opacity-60"
          >
            {isFetching ? "Retrying…" : "Retry"}
          </button>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : data?.items.length === 0 ? (
        <div className="text-center py-20 rounded-2xl border border-secondary/10 bg-gradient-to-b from-white to-slate-50 shadow-[0_16px_40px_-22px_rgba(26,39,68,0.4)]">
          <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary/15">
            <Search size={28} className="text-primary" />
          </div>
          <h3 className="text-lg font-heading font-bold text-secondary mb-2">No suppliers found</h3>
          <p className="text-muted-foreground text-sm mb-6">Try adjusting your search or filters</p>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setInputSearch("");
              applyVerified(null);
            }}
            className="kb-btn-primary px-6 py-2.5 text-sm"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data?.items.map((supplier, i) => {
              const cover = supplier.coverUrl || null;
              return (
              <motion.div
                key={supplier.id}
                role="link"
                tabIndex={0}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.3) }}
                onClick={() => navigate(`/suppliers/${supplier.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(`/suppliers/${supplier.id}`);
                  }
                }}
                className="kb-card-interactive overflow-hidden text-left group cursor-pointer flex flex-col !p-0 !m-0"
                style={{ padding: 0, margin: 0 }}
              >
                {/* Full-bleed cover — bleed under border; photo + color share same box */}
                <div
                  className={`relative h-[4.5rem] shrink-0 overflow-hidden rounded-t-[0.95rem] ${
                    cover
                      ? "bg-secondary/15"
                      : `bg-gradient-to-r ${avatarGradients[i % avatarGradients.length]}`
                  }`}
                  style={{
                    margin: "-1px -1px 0",
                    width: "calc(100% + 2px)",
                    ...(cover
                      ? {
                          backgroundImage: `url("${cover}")`,
                          backgroundSize: "cover",
                          backgroundPosition: "center top",
                          backgroundRepeat: "no-repeat",
                        }
                      : {}),
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-secondary/30 via-transparent to-transparent pointer-events-none" />
                </div>

                <div className="p-4 sm:p-5 flex-1 flex flex-col">
                  <div className="flex items-start gap-3 mb-3 -mt-8 relative z-[1]">
                    {supplier.logoUrl ? (
                      <img
                        src={supplier.logoUrl}
                        alt=""
                        className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border-2 border-white shadow-md bg-white"
                      />
                    ) : (
                      <div
                        className={`w-12 h-12 rounded-xl bg-gradient-to-br ${avatarGradients[i % avatarGradients.length]} flex items-center justify-center flex-shrink-0 shadow-md border-2 border-white`}
                      >
                        <span className="text-lg font-bold text-white">
                          {supplier.companyName[0]}
                        </span>
                      </div>
                    )}
                    <div className="min-w-0 flex-1 pt-8">
                      <div className="flex items-start gap-1.5 flex-wrap mb-0.5">
                        <h3 className="font-bold text-sm sm:text-base text-foreground leading-tight">
                          {supplier.companyName}
                        </h3>
                      </div>
                      <div className="flex items-center gap-1 flex-wrap mt-0.5">
                        {supplier.verified && (
                          <span className="flex items-center gap-0.5 text-green-700 text-[10px] font-bold bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">
                            <CheckCircle size={9} /> Verified
                          </span>
                        )}
                        <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                          <MapPin size={10} /> {supplier.location}
                        </span>
                      </div>
                    </div>
                  </div>

                  <StarRating rating={supplier.rating} reviewCount={supplier.reviewCount} />

                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                    <span className="font-medium text-foreground/80">
                      {formatProductCount(supplier.productCount)}
                    </span>
                    {(() => {
                      const yearsLabel = formatYearsInBusiness(supplier.yearsInBusiness);
                      return yearsLabel ? (
                        <>
                          <span className="text-border" aria-hidden>
                            ·
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock size={10} />
                            {yearsLabel}
                          </span>
                        </>
                      ) : null;
                    })()}
                    {supplier.responseRate ? (
                      <>
                        <span className="text-border" aria-hidden>
                          ·
                        </span>
                        <span className="inline-flex items-center gap-1 text-green-600 font-medium">
                          <CheckCircle size={10} /> {supplier.responseRate}% response
                        </span>
                      </>
                    ) : null}
                  </div>

                  {supplier.mainProducts && supplier.mainProducts.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {supplier.mainProducts.slice(0, 3).map((p) => (
                        <span
                          key={p}
                          className="bg-accent text-accent-foreground text-xs px-2 py-0.5 rounded-full border border-accent-border"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-auto pt-3 border-t border-border flex items-center justify-between">
                    <span className="text-xs text-primary font-semibold group-hover:underline flex items-center gap-1">
                      View Profile <ArrowRight size={11} />
                    </span>
                  </div>
                </div>
              </motion.div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-10">
              <button
                type="button"
                onClick={() => writeSuppliersQuery({ page: Math.max(1, page - 1) })}
                disabled={page === 1}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-2 border border-secondary/15 bg-white rounded-xl disabled:opacity-40 hover:bg-accent transition-colors text-sm font-medium"
              >
                <ChevronLeft size={15} /> <span className="hidden sm:inline">Prev</span>
              </button>
              <span className="text-sm font-semibold px-4 text-muted-foreground">Page {page} of {totalPages}</span>
              <button
                type="button"
                onClick={() => writeSuppliersQuery({ page: Math.min(totalPages, page + 1) })}
                disabled={page === totalPages}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-2 border border-secondary/15 bg-white rounded-xl disabled:opacity-40 hover:bg-accent transition-colors text-sm font-medium"
              >
                <span className="hidden sm:inline">Next</span> <ChevronRight size={15} />
              </button>
            </div>
          )}
        </>
      )}
      </div>
    </div>
  );
}
