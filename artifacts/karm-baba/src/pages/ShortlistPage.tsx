import { useLocation } from "wouter";
import { Heart, Package } from "lucide-react";
import { useListProducts } from "@workspace/api-client-react";
import { useShortlist } from "@/hooks/useShortlist";
import { StarRating } from "@/components/StarRating";

export function ShortlistPage() {
  const [, navigate] = useLocation();
  const { ids, toggle, clear, count } = useShortlist();
  const { data, isLoading } = useListProducts({ limit: 100, page: 1 });

  const items = (data?.items ?? []).filter((p) => ids.includes(p.id));

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
            <Heart className="text-primary" size={22} /> Shortlist
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Save products while browsing — like Alibaba favorites — then compare and RFQ.
          </p>
        </div>
        {count > 0 && (
          <button onClick={clear} className="text-sm text-muted-foreground hover:text-destructive border border-border rounded-xl px-3 py-2">
            Clear all
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-56 bg-muted animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : count === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-border">
          <Package className="mx-auto text-muted-foreground mb-3" />
          <h3 className="font-heading font-bold mb-2">No saved products yet</h3>
          <button onClick={() => navigate("/products")} className="text-primary text-sm font-semibold">
            Browse products →
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((product) => (
            <div key={product.id} className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm">
              <button onClick={() => navigate(`/products/${product.id}`)} className="w-full text-left">
                <img src={product.imageUrl} alt={product.name} className="h-36 w-full object-cover" />
                <div className="p-3">
                  <h3 className="text-sm font-semibold line-clamp-2 mb-1">{product.name}</h3>
                  <div className="text-primary font-bold text-sm">
                    ₹{product.minPrice}–{product.maxPrice}
                  </div>
                  {product.rating && <StarRating rating={product.rating} size={10} />}
                </div>
              </button>
              <div className="px-3 pb-3 flex gap-2">
                <button
                  onClick={() => navigate(`/products/${product.id}`)}
                  className="flex-1 bg-primary text-white text-xs font-semibold py-2 rounded-xl"
                >
                  Get Best Price
                </button>
                <button
                  onClick={() => toggle(product.id)}
                  className="px-3 border border-border rounded-xl text-xs font-semibold hover:bg-muted"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
