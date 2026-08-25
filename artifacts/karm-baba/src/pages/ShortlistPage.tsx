import { useQueries } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Heart, Package, AlertCircle } from "lucide-react";
import { getProduct, getGetProductQueryKey } from "@workspace/api-client-react";
import { useShortlist } from "@/hooks/useShortlist";
import { StarRating } from "@/components/StarRating";
import { ProductImage } from "@/components/ProductImage";
import { useAppDialog } from "@/components/AppDialog";

export function ShortlistPage() {
  const [, navigate] = useLocation();
  const { ids, toggle, clear, count } = useShortlist();
  const { confirm } = useAppDialog();

  const queries = useQueries({
    queries: ids.map((id) => ({
      queryKey: getGetProductQueryKey(id),
      queryFn: ({ signal }: { signal?: AbortSignal }) => getProduct(id, { signal }),
      staleTime: 60_000,
      retry: 1,
    })),
  });

  const isLoading = count > 0 && queries.some((q) => q.isLoading);
  const items = queries
    .map((q, i) => ({ product: q.data, id: ids[i], error: q.isError }))
    .filter((row) => row.product != null)
    .map((row) => row.product!);
  const missing = count - items.length;
  const hasFetchError = queries.some((q) => q.isError);

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
          <button
            type="button"
            onClick={() => {
              void (async () => {
                const ok = await confirm({
                  title: "Clear shortlist?",
                  message: `Clear all ${count} shortlisted product${count === 1 ? "" : "s"}? This cannot be undone.`,
                  confirmLabel: "Clear all",
                  cancelLabel: "Keep",
                  destructive: true,
                });
                if (ok) clear();
              })();
            }}
            className="text-sm text-muted-foreground hover:text-destructive border border-border rounded-xl px-3 py-2 min-h-11"
          >
            Clear all
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: Math.min(count, 8) || 4 }).map((_, i) => (
            <div key={i} className="h-56 bg-muted animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : count === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-border">
          <Package className="mx-auto text-muted-foreground mb-3" />
          <h3 className="font-heading font-bold mb-2">No saved products yet</h3>
          <button
            type="button"
            onClick={() => navigate("/products")}
            className="bg-primary hover:bg-primary/90 text-white text-sm font-semibold min-h-11 px-6 rounded-xl"
          >
            Browse products →
          </button>
        </div>
      ) : (
        <>
          {(hasFetchError || missing > 0) && (
            <div className="mb-4 flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <span>
                {missing > 0
                  ? `${missing} saved item${missing === 1 ? "" : "s"} could not be loaded (removed or unavailable).`
                  : "Some shortlisted products failed to load. Refresh and try again."}
              </span>
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map((product) => (
              <div
                key={product.id}
                className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => navigate(`/products/${product.id}`)}
                  className="w-full text-left"
                >
                  <ProductImage
                    src={product.imageUrl}
                    alt={product.name}
                    className="h-36 w-full object-cover"
                  />
                  <div className="p-3">
                    <h3 className="text-sm font-semibold line-clamp-2 mb-1">{product.name}</h3>
                    <div className="text-primary font-bold text-sm">
                      ₹{product.minPrice}–{product.maxPrice}
                    </div>
                    {product.rating != null && <StarRating rating={product.rating} size={10} />}
                  </div>
                </button>
                <div className="px-3 pb-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/products/${product.id}`)}
                    className="flex-1 bg-primary text-white text-sm font-semibold min-h-11 rounded-xl"
                  >
                    Request quote
                  </button>
                  <button
                    type="button"
                    onClick={() => toggle(product.id)}
                    className="px-3 border border-border rounded-xl text-sm font-semibold hover:bg-muted min-h-11"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
