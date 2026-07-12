import { useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle, ChevronLeft, Package, Send, Star, AlertCircle, Shield, Truck, Clock, Tag, Heart } from "lucide-react";
import { motion } from "framer-motion";
import { useGetProduct, useListReviews, useCreateRfq, useCreateReview, useListProducts } from "@workspace/api-client-react";
import { StarRating } from "@/components/StarRating";
import { useAuth } from "@/context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { getListRfqsQueryKey, getListReviewsQueryKey } from "@workspace/api-client-react";
import { useShortlist } from "@/hooks/useShortlist";

export function ProductDetailPage({ params }: { params: { id: string } }) {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const qc = useQueryClient();

  const productId = Number(params.id);
  const { data: product, isLoading } = useGetProduct(productId, { query: { enabled: !!productId } as any });
  const { data: reviews } = useListReviews({ productId }, { query: { enabled: !!productId } as any });
  const { data: related } = useListProducts(
    { categoryId: product?.categoryId, limit: 4, page: 1 },
    { query: { enabled: !!product?.categoryId } as any },
  );
  const { toggle, has } = useShortlist();

  const [selectedImg, setSelectedImg] = useState(0);
  const [rfqOpen, setRfqOpen] = useState(false);
  const [rfqForm, setRfqForm] = useState({ quantity: "", unit: product?.unit ?? "piece", targetPrice: "", description: "", buyerName: user?.name ?? "", buyerEmail: user?.email ?? "" });
  const [rfqSuccess, setRfqSuccess] = useState(false);
  const [rfqError, setRfqError] = useState("");
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: "" });
  const [reviewMsg, setReviewMsg] = useState("");

  const createRfq = useCreateRfq();
  const createReview = useCreateReview();

  async function handleRfqSubmit(e: React.FormEvent) {
    e.preventDefault();
    setRfqError("");
    if (!rfqForm.quantity || !rfqForm.buyerName || !rfqForm.buyerEmail) {
      setRfqError("Please fill all required fields.");
      return;
    }
    try {
      await createRfq.mutateAsync({
        data: {
          productId: product?.id,
          productName: product?.name ?? "",
          supplierId: product?.supplierId,
          buyerName: rfqForm.buyerName,
          buyerEmail: rfqForm.buyerEmail,
          quantity: Number(rfqForm.quantity),
          unit: rfqForm.unit || product?.unit || "piece",
          targetPrice: rfqForm.targetPrice ? Number(rfqForm.targetPrice) : undefined,
          description: rfqForm.description || undefined,
        }
      });
      qc.invalidateQueries({ queryKey: getListRfqsQueryKey() });
      setRfqSuccess(true);
    } catch {
      setRfqError("Failed to send RFQ. Please try again.");
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 animate-pulse">
        <div className="h-5 bg-muted rounded-full w-40 mb-8" />
        <div className="grid md:grid-cols-2 gap-10">
          <div className="bg-muted rounded-2xl aspect-square" />
          <div className="space-y-4">
            <div className="h-8 bg-muted rounded-xl w-3/4" />
            <div className="h-6 bg-muted rounded-xl w-1/2" />
            <div className="h-24 bg-muted rounded-2xl" />
            <div className="h-12 bg-muted rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-24 text-center">
        <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Package size={28} className="text-muted-foreground" />
        </div>
        <h2 className="text-xl font-heading font-bold mb-2">Product Not Found</h2>
        <button onClick={() => navigate("/products")} className="text-primary hover:underline text-sm font-medium">← Back to products</button>
      </div>
    );
  }

  const allImages = product.images?.length ? product.images : [product.imageUrl];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <button onClick={() => navigate("/products")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-7 font-medium">
        <ChevronLeft size={16} /> Back to Products
      </button>

      <div className="grid md:grid-cols-2 gap-10 mb-12">
        {/* Image gallery */}
        <div>
          <div className="rounded-2xl overflow-hidden bg-muted mb-3 aspect-square shadow-sm border border-border">
            <motion.img
              key={selectedImg}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              src={allImages[selectedImg]}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>
          {allImages.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {allImages.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImg(i)}
                  className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 ${selectedImg === i ? "border-primary shadow-md scale-105" : "border-border hover:border-primary/50"}`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product info */}
        <div>
          {/* Badges */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="bg-accent text-accent-foreground text-xs font-semibold px-2.5 py-1 rounded-full border border-accent-border">
              {product.categoryName}
            </span>
            {product.inStock ? (
              <span className="bg-green-50 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-green-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" /> In Stock
              </span>
            ) : (
              <span className="bg-red-50 text-red-600 text-xs font-semibold px-2.5 py-1 rounded-full border border-red-200">Out of Stock</span>
            )}
          </div>

          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground mb-3 leading-tight">{product.name}</h1>

          {product.rating && (
            <div className="mb-4">
              <StarRating rating={product.rating} reviewCount={product.reviewCount} size={16} />
            </div>
          )}

          {/* Price card */}
          <div className="bg-gradient-to-br from-accent to-orange-50 rounded-2xl p-5 mb-5 border border-orange-100">
            <div className="flex items-baseline gap-1 mb-1">
              <span className="font-heading text-4xl font-black text-primary">₹{product.minPrice}</span>
              <span className="text-xl font-bold text-muted-foreground">– ₹{product.maxPrice}</span>
            </div>
            <div className="text-sm text-muted-foreground">per {product.unit}</div>
            <div className="mt-3 flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5 text-foreground">
                <Tag size={14} className="text-primary" />
                <span>Min. Order: <span className="font-bold">{product.minOrder} {product.unit}</span></span>
              </div>
            </div>
          </div>

          {product.description && (
            <p className="text-muted-foreground text-sm leading-relaxed mb-4">{product.description}</p>
          )}

          {product.tags && product.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-5">
              {product.tags.map(tag => (
                <span key={tag} className="bg-muted text-muted-foreground text-xs font-medium px-2.5 py-1 rounded-full">#{tag}</span>
              ))}
            </div>
          )}

          {/* Supplier card */}
          <div
            className="bg-white border border-border rounded-2xl p-4 mb-5 cursor-pointer hover:border-primary/30 hover:shadow-md transition-all group"
            onClick={() => navigate(`/suppliers/${product.supplierId}`)}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-orange-100 flex items-center justify-center flex-shrink-0">
                <span className="font-bold text-primary text-base">{product.supplierName?.[0]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-sm text-foreground">{product.supplierName}</span>
                  {product.supplierVerified && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">
                      <CheckCircle size={9} /> Verified
                    </span>
                  )}
                </div>
                <div className="text-xs text-primary font-medium mt-0.5 group-hover:underline">View Supplier Profile →</div>
              </div>
            </div>
          </div>

          {/* Trust signals */}
          <div className="grid grid-cols-3 gap-2 mb-5">
            {[
              { icon: <Shield size={14} />, label: "Verified" },
              { icon: <Truck size={14} />, label: "Fast Ship" },
              { icon: <Clock size={14} />, label: "24h Reply" },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-1.5 bg-muted rounded-xl p-2.5 text-xs font-medium text-muted-foreground">
                <span className="text-primary">{item.icon}</span> {item.label}
              </div>
            ))}
          </div>

          {/* RFQ + shortlist */}
          <div className="flex gap-2">
            <button
              onClick={() => setRfqOpen(true)}
              className="flex-1 bg-primary hover:bg-primary/90 text-white py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2.5 transition-all hover:shadow-xl hover:shadow-primary/25 hover:-translate-y-0.5"
            >
              <Send size={18} /> Get Best Price
            </button>
            <button
              onClick={() => toggle(product.id)}
              className={`px-4 rounded-2xl border font-semibold transition-colors ${has(product.id) ? "bg-primary/10 border-primary text-primary" : "border-border hover:bg-muted"}`}
              title="Save to shortlist"
            >
              <Heart size={18} className={has(product.id) ? "fill-primary" : ""} />
            </button>
          </div>
        </div>
      </div>

      {/* Reviews */}
      <section className="mb-12">
        <h2 className="font-heading text-xl font-bold mb-5">
          Customer Reviews {reviews?.length ? `(${reviews.length})` : ""}
        </h2>

        {user && (
          <form
            className="bg-white border border-border rounded-2xl p-4 mb-5 shadow-sm space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setReviewMsg("");
              try {
                await createReview.mutateAsync({
                  data: {
                    productId: product.id,
                    supplierId: product.supplierId,
                    reviewerId: user.id,
                    reviewerName: user.name,
                    rating: reviewForm.rating,
                    comment: reviewForm.comment || "No comment provided",
                  },
                });
                qc.invalidateQueries({ queryKey: getListReviewsQueryKey({ productId }) });
                setReviewForm({ rating: 5, comment: "" });
                setReviewMsg("Thanks — your review was published.");
              } catch {
                setReviewMsg("Could not submit review. Sign in and try again.");
              }
            }}
          >
            <div className="font-semibold text-sm">Write a review</div>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setReviewForm((f) => ({ ...f, rating: n }))}
                  className="p-0.5"
                >
                  <Star size={18} className={n <= reviewForm.rating ? "fill-amber-400 text-amber-400" : "text-gray-200"} />
                </button>
              ))}
            </div>
            <textarea
              value={reviewForm.comment}
              onChange={(e) => setReviewForm((f) => ({ ...f, comment: e.target.value }))}
              rows={2}
              placeholder="Share quality, packaging, delivery experience..."
              className="w-full border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button type="submit" className="bg-secondary text-white text-sm font-semibold px-4 py-2 rounded-xl">
              Submit review
            </button>
            {reviewMsg && <p className="text-xs text-muted-foreground">{reviewMsg}</p>}
          </form>
        )}

        {reviews && reviews.length > 0 ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {reviews.map((review, i) => (
              <motion.div
                key={review.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white border border-border rounded-2xl p-4 shadow-sm"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-orange-100 flex items-center justify-center text-primary text-sm font-bold">
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
                <p className="text-muted-foreground text-sm leading-relaxed">{review.comment}</p>
              </motion.div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No reviews yet — be the first to rate this product.</p>
        )}
      </section>

      {/* Related products */}
      {related?.items && related.items.filter((p) => p.id !== product.id).length > 0 && (
        <section className="mb-12">
          <h2 className="font-heading text-xl font-bold mb-5">Related products</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {related.items
              .filter((p) => p.id !== product.id)
              .slice(0, 4)
              .map((p) => (
                <button
                  key={p.id}
                  onClick={() => navigate(`/products/${p.id}`)}
                  className="bg-white border border-border rounded-2xl overflow-hidden text-left hover:border-primary/30 shadow-sm"
                >
                  <img src={p.imageUrl} alt={p.name} className="h-28 w-full object-cover" />
                  <div className="p-3">
                    <div className="text-xs font-semibold line-clamp-2 mb-1">{p.name}</div>
                    <div className="text-primary text-sm font-bold">₹{p.minPrice}–{p.maxPrice}</div>
                  </div>
                </button>
              ))}
          </div>
        </section>
      )}

      {/* RFQ Modal */}
      {rfqOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
          >
            {rfqSuccess ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={36} className="text-green-500" />
                </div>
                <h3 className="font-heading text-xl font-bold mb-2">RFQ Sent Successfully!</h3>
                <p className="text-muted-foreground text-sm mb-6 max-w-xs mx-auto">The supplier will respond to your inquiry within 24 hours.</p>
                <div className="flex gap-3">
                  <button onClick={() => { setRfqOpen(false); setRfqSuccess(false); }} className="flex-1 border border-border py-2.5 rounded-xl text-sm font-semibold hover:bg-muted transition-colors">Close</button>
                  <button onClick={() => navigate("/rfq")} className="flex-1 bg-primary text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">View My RFQs</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="font-heading text-lg font-bold">Request for Quotation</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Supplier will respond within 24 hours</p>
                  </div>
                  <button onClick={() => setRfqOpen(false)} className="w-8 h-8 rounded-xl hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors text-lg">✕</button>
                </div>
                <div className="bg-accent rounded-xl p-3 mb-5 border border-accent-border">
                  <div className="text-xs text-muted-foreground mb-0.5">Product</div>
                  <div className="text-sm font-semibold text-foreground">{product.name}</div>
                </div>
                <form onSubmit={handleRfqSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Quantity *</label>
                      <input type="number" value={rfqForm.quantity} onChange={e => setRfqForm(f => ({ ...f, quantity: e.target.value }))} className="w-full border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all" placeholder="e.g. 100" required />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Unit</label>
                      <input type="text" value={rfqForm.unit || product.unit} onChange={e => setRfqForm(f => ({ ...f, unit: e.target.value }))} className="w-full border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Target Price per Unit (₹) <span className="text-muted-foreground font-normal">— Optional</span></label>
                    <input type="number" value={rfqForm.targetPrice} onChange={e => setRfqForm(f => ({ ...f, targetPrice: e.target.value }))} className="w-full border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all" placeholder="Your budget" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Your Name *</label>
                    <input type="text" value={rfqForm.buyerName} onChange={e => setRfqForm(f => ({ ...f, buyerName: e.target.value }))} className="w-full border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all" required />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Email Address *</label>
                    <input type="email" value={rfqForm.buyerEmail} onChange={e => setRfqForm(f => ({ ...f, buyerEmail: e.target.value }))} className="w-full border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all" required />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Requirements & Specifications</label>
                    <textarea value={rfqForm.description} onChange={e => setRfqForm(f => ({ ...f, description: e.target.value }))} className="w-full border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all resize-none" rows={3} placeholder="Describe color, size, quality, delivery timeline..." />
                  </div>
                  {rfqError && (
                    <div className="flex items-center gap-2 text-destructive text-sm bg-red-50 p-3 rounded-xl border border-red-200">
                      <AlertCircle size={14} className="flex-shrink-0" /> {rfqError}
                    </div>
                  )}
                  <div className="flex gap-3 pt-1">
                    <button type="button" onClick={() => setRfqOpen(false)} className="flex-1 border border-border py-3 rounded-xl text-sm font-semibold hover:bg-muted transition-colors">Cancel</button>
                    <button type="submit" disabled={createRfq.isPending} className="flex-1 bg-primary text-white py-3 rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5">
                      {createRfq.isPending ? "Sending..." : <><Send size={14} /> Send RFQ</>}
                    </button>
                  </div>
                </form>
              </>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
