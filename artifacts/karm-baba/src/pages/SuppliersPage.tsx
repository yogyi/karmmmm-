import { useState } from "react";
import { useLocation } from "wouter";
import { Search, CheckCircle, ChevronLeft, ChevronRight, MapPin, Clock, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useListSuppliers } from "@workspace/api-client-react";
import { StarRating } from "@/components/StarRating";

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-border p-5 animate-pulse shadow-sm">
      <div className="flex gap-4 mb-4">
        <div className="w-14 h-14 bg-muted rounded-2xl flex-shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-4 bg-muted rounded-full w-3/4" />
          <div className="h-3 bg-muted rounded-full w-1/2" />
        </div>
      </div>
      <div className="h-3 bg-muted rounded-full w-full mb-2" />
      <div className="h-3 bg-muted rounded-full w-2/3" />
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
  const [search, setSearch] = useState("");
  const [inputSearch, setInputSearch] = useState("");
  const [verified, setVerified] = useState<boolean | null>(null);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useListSuppliers({
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
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-foreground">Supplier Directory</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {data ? `${data.total.toLocaleString()} verified suppliers across India` : "Loading..."}
        </p>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1">
          <div className="flex border border-border rounded-xl overflow-hidden flex-1 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 transition-all shadow-sm bg-white">
            <input
              type="text"
              value={inputSearch}
              onChange={e => setInputSearch(e.target.value)}
              placeholder="Search suppliers by name or product..."
              className="flex-1 px-4 py-2.5 text-sm outline-none bg-transparent"
            />
            <button type="submit" className="bg-primary text-white px-4 py-2.5 hover:bg-primary/90 transition-colors flex-shrink-0">
              <Search size={16} />
            </button>
          </div>
        </form>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => { setVerified(null); setPage(1); }}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${verified === null ? "bg-primary text-white shadow-sm" : "border border-border hover:bg-muted bg-white"}`}
          >
            All
          </button>
          <button
            onClick={() => { setVerified(true); setPage(1); }}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${verified === true ? "bg-green-600 text-white shadow-sm" : "border border-border hover:bg-muted bg-white"}`}
          >
            <CheckCircle size={14} /> <span className="hidden sm:inline">Verified Only</span><span className="sm:hidden">Verified</span>
          </button>
        </div>
      </div>

      {/* Supplier grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : data?.items.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-border">
          <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Search size={28} className="text-muted-foreground" />
          </div>
          <h3 className="text-lg font-heading font-bold mb-2">No suppliers found</h3>
          <p className="text-muted-foreground text-sm mb-6">Try adjusting your search or filters</p>
          <button
            onClick={() => { setSearch(""); setInputSearch(""); setVerified(null); }}
            className="bg-primary text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data?.items.map((supplier, i) => (
              <motion.button
                key={supplier.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.3) }}
                onClick={() => navigate(`/suppliers/${supplier.id}`)}
                className="bg-white rounded-2xl border border-border overflow-hidden hover:border-primary/30 hover:shadow-lg transition-all text-left group card-hover"
              >
                {supplier.coverUrl ? (
                  <div className="h-20 overflow-hidden">
                    <img src={supplier.coverUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80" />
                  </div>
                ) : (
                  <div className={`h-12 bg-gradient-to-r ${avatarGradients[i % avatarGradients.length]} opacity-20`} />
                )}

                <div className="p-4 sm:p-5">
                  <div className="flex items-start gap-3 mb-3">
                    {supplier.logoUrl ? (
                      <img src={supplier.logoUrl} alt={supplier.companyName} className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-border shadow-sm" />
                    ) : (
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${avatarGradients[i % avatarGradients.length]} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                        <span className="text-lg font-bold text-white">{supplier.companyName[0]}</span>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-1.5 flex-wrap mb-0.5">
                        <h3 className="font-bold text-sm sm:text-base text-foreground leading-tight">{supplier.companyName}</h3>
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

                  <div className="mt-3 grid grid-cols-2 gap-1.5 text-xs text-muted-foreground">
                    {supplier.yearsInBusiness && (
                      <span className="flex items-center gap-1">
                        <Clock size={10} /> {supplier.yearsInBusiness}yr experience
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/50" /> {supplier.productCount} products
                    </span>
                    {supplier.responseRate && (
                      <span className="flex items-center gap-1 col-span-2 text-green-600 font-medium">
                        <CheckCircle size={10} /> {supplier.responseRate}% response rate
                      </span>
                    )}
                  </div>

                  {supplier.mainProducts && supplier.mainProducts.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {supplier.mainProducts.slice(0, 3).map(p => (
                        <span key={p} className="bg-accent text-accent-foreground text-xs px-2 py-0.5 rounded-full border border-accent-border">{p}</span>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                    <span className="text-xs text-primary font-semibold group-hover:underline flex items-center gap-1">
                      View Profile <ArrowRight size={11} />
                    </span>
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
              <span className="text-sm font-semibold px-4 text-muted-foreground">Page {page} of {totalPages}</span>
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
  );
}
