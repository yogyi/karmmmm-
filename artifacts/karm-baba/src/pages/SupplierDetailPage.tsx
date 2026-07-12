import { useLocation } from "wouter";
import { CheckCircle, ChevronLeft, MapPin, Users, Clock, Star, Send, Award, Package, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { useGetSupplier, useListProducts, useListReviews } from "@workspace/api-client-react";
import { StarRating } from "@/components/StarRating";

export function SupplierDetailPage({ params }: { params: { id: string } }) {
  const [, navigate] = useLocation();
  const supplierId = Number(params.id);

  const { data: supplier, isLoading } = useGetSupplier(supplierId, { query: { enabled: !!supplierId } as any });
  const { data: productsData } = useListProducts({ supplierId }, { query: { enabled: !!supplierId } as any });
  const { data: reviews } = useListReviews({ supplierId }, { query: { enabled: !!supplierId } as any });

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-56 bg-muted" />
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-4">
          <div className="h-8 bg-muted rounded-xl w-64" />
          <div className="h-4 bg-muted rounded-xl w-1/2" />
        </div>
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-24 text-center">
        <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Package size={28} className="text-muted-foreground" />
        </div>
        <h2 className="text-xl font-heading font-bold mb-2">Supplier Not Found</h2>
        <button onClick={() => navigate("/suppliers")} className="text-primary hover:underline text-sm font-medium">
          ← Back to Suppliers
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Cover */}
      <div className="relative h-52 sm:h-72 overflow-hidden">
        {supplier.coverUrl ? (
          <img src={supplier.coverUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-secondary via-secondary/90 to-blue-900">
            <div className="absolute inset-0 hero-pattern pointer-events-none" />
            <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
              <div className="text-9xl font-heading font-black text-white">{supplier.companyName[0]}</div>
            </div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
        <button
          onClick={() => navigate("/suppliers")}
          className="absolute top-4 left-4 flex items-center gap-1.5 bg-white/90 hover:bg-white text-sm font-semibold px-3.5 py-2 rounded-xl transition-colors shadow-sm"
        >
          <ChevronLeft size={14} /> All Suppliers
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-4">
        {/* Profile header */}
        <div className="relative -mt-16 mb-8">
          <div className="flex flex-col sm:flex-row items-start gap-5">
            {/* Logo */}
            <div className="w-28 h-28 rounded-2xl bg-white border-4 border-white shadow-xl overflow-hidden flex-shrink-0">
              {supplier.logoUrl ? (
                <img src={supplier.logoUrl} alt={supplier.companyName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/20 to-orange-100 flex items-center justify-center">
                  <span className="text-4xl font-heading font-black text-primary">{supplier.companyName[0]}</span>
                </div>
              )}
            </div>

            <div className="pt-2 sm:pt-16 flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground">{supplier.companyName}</h1>
                {supplier.verified && (
                  <span className="inline-flex items-center gap-1.5 text-green-700 text-xs font-bold bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                    <CheckCircle size={13} /> Verified Supplier
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground text-sm mb-2">
                <MapPin size={14} className="flex-shrink-0" />
                {supplier.location}{supplier.country && `, ${supplier.country}`}
              </div>
              <StarRating rating={supplier.rating} reviewCount={supplier.reviewCount} size={16} />
            </div>

            <div className="sm:mt-14 flex gap-2 flex-shrink-0">
              <button
                onClick={() => navigate(`/rfq/new?supplierId=${supplier.id}&supplierName=${encodeURIComponent(supplier.companyName)}`)}
                className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-all hover:shadow-lg hover:shadow-primary/25"
              >
                <Send size={15} /> Send Inquiry
              </button>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 pb-16">
          {/* Main content */}
          <div className="md:col-span-2 space-y-5">
            {supplier.description && (
              <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
                <h2 className="font-heading font-bold text-lg mb-3 flex items-center gap-2">
                  About the Company
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed">{supplier.description}</p>
              </div>
            )}

            {/* Products */}
            {productsData && productsData.items.length > 0 && (
              <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-heading font-bold text-lg">Products</h2>
                  <span className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full font-medium">{productsData.total} total</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {productsData.items.slice(0, 6).map((product, i) => (
                    <motion.button
                      key={product.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.04 }}
                      onClick={() => navigate(`/products/${product.id}`)}
                      className="border border-border rounded-2xl overflow-hidden hover:border-primary/30 hover:shadow-md transition-all text-left group card-hover"
                    >
                      <div className="h-28 overflow-hidden bg-muted relative">
                        <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="p-2.5">
                        <div className="text-xs font-semibold text-foreground line-clamp-2 leading-tight mb-1">{product.name}</div>
                        <div className="text-primary font-bold text-xs">₹{product.minPrice}–{product.maxPrice}</div>
                      </div>
                    </motion.button>
                  ))}
                </div>
                {productsData.total > 6 && (
                  <button
                    onClick={() => navigate(`/products?supplierId=${supplier.id}`)}
                    className="mt-4 w-full py-2.5 border border-border rounded-xl text-sm font-semibold text-muted-foreground hover:text-primary hover:border-primary transition-colors"
                  >
                    View all {productsData.total} products →
                  </button>
                )}
              </div>
            )}

            {/* Reviews */}
            {reviews && reviews.length > 0 && (
              <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
                <h2 className="font-heading font-bold text-lg mb-4">Customer Reviews ({reviews.length})</h2>
                <div className="space-y-4">
                  {reviews.map((review, i) => (
                    <motion.div
                      key={review.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className="border-b border-border last:border-0 pb-4 last:pb-0"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-orange-100 flex items-center justify-center text-primary text-sm font-bold flex-shrink-0">
                            {review.reviewerName[0]}
                          </div>
                          <span className="font-semibold text-sm">{review.reviewerName}</span>
                        </div>
                        <div className="flex">
                          {[1,2,3,4,5].map(i => (
                            <Star key={i} size={12} className={i <= review.rating ? "fill-amber-400 text-amber-400" : "text-gray-200"} />
                          ))}
                        </div>
                      </div>
                      <p className="text-muted-foreground text-sm leading-relaxed pl-10">{review.comment}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Company stats */}
            <div className="bg-white rounded-2xl border border-border p-5 shadow-sm">
              <h3 className="font-heading font-bold mb-4 text-base">Company Stats</h3>
              <div className="space-y-3">
                {supplier.yearsInBusiness && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock size={14} /> Years in Business
                    </div>
                    <span className="font-bold text-foreground text-sm">{supplier.yearsInBusiness}yr</span>
                  </div>
                )}
                {supplier.employeeCount && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users size={14} /> Employees
                    </div>
                    <span className="font-bold text-foreground text-sm">{supplier.employeeCount}</span>
                  </div>
                )}
                {productsData && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Package size={14} /> Products Listed
                    </div>
                    <span className="font-bold text-foreground text-sm">{productsData.total}</span>
                  </div>
                )}
                {supplier.responseRate && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <TrendingUp size={14} /> Response Rate
                      </div>
                      <span className="font-bold text-green-600 text-sm">{supplier.responseRate}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: `${supplier.responseRate}%` }}
                      />
                    </div>
                  </div>
                )}
                {supplier.responseTime && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock size={14} /> Response Time
                    </div>
                    <span className="font-bold text-foreground text-sm">{supplier.responseTime}</span>
                  </div>
                )}
              </div>
            </div>

            {supplier.mainProducts && supplier.mainProducts.length > 0 && (
              <div className="bg-white rounded-2xl border border-border p-5 shadow-sm">
                <h3 className="font-heading font-bold mb-3 text-base">Main Products</h3>
                <div className="flex flex-wrap gap-2">
                  {supplier.mainProducts.map(p => (
                    <span key={p} className="bg-accent text-accent-foreground text-xs font-medium px-2.5 py-1 rounded-full border border-accent-border">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {supplier.certifications && supplier.certifications.length > 0 && (
              <div className="bg-white rounded-2xl border border-border p-5 shadow-sm">
                <h3 className="font-heading font-bold mb-3 text-base flex items-center gap-2">
                  <Award size={16} className="text-primary" /> Certifications
                </h3>
                <div className="space-y-2">
                  {supplier.certifications.map(cert => (
                    <div key={cert} className="flex items-center gap-2 text-sm bg-green-50 border border-green-100 rounded-xl px-3 py-2">
                      <CheckCircle size={13} className="text-green-600 flex-shrink-0" />
                      <span className="text-green-800 font-medium">{cert}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CTA card */}
            <div className="bg-gradient-to-br from-secondary to-secondary/80 rounded-2xl p-5 text-white text-center">
              <div className="text-2xl mb-2">🤝</div>
              <div className="font-heading font-bold mb-1">Ready to Trade?</div>
              <p className="text-white/70 text-xs mb-3 leading-relaxed">Send an inquiry and get a response within 24 hours</p>
              <button
                onClick={() => navigate(`/rfq/new?supplierId=${supplier.id}&supplierName=${encodeURIComponent(supplier.companyName)}`)}
                className="w-full bg-primary hover:bg-primary/90 text-white py-2.5 rounded-xl text-sm font-bold transition-all"
              >
                Send Inquiry →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
