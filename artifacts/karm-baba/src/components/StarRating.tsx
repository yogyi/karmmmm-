import { Star } from "lucide-react";

interface StarRatingProps {
  rating: number;
  reviewCount?: number;
  size?: number;
}

export function StarRating({ rating, reviewCount, size = 14 }: StarRatingProps) {
  const safeRating = Number.isFinite(rating) ? Math.min(5, Math.max(0, rating)) : 0;
  const filled = Math.round(safeRating);

  return (
    <div className="flex items-center gap-1" title={`${safeRating.toFixed(1)} out of 5`}>
      <div className="flex items-center" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            size={size}
            className={i <= filled ? "fill-amber-400 text-amber-400" : "text-gray-300"}
          />
        ))}
      </div>
      <span className="text-xs font-medium text-muted-foreground">
        {safeRating.toFixed(1)}
        {reviewCount != null && reviewCount > 0 && <span className="ml-1">({reviewCount})</span>}
      </span>
      <span className="sr-only">
        Rated {safeRating.toFixed(1)} out of 5
        {reviewCount != null && reviewCount > 0 ? ` from ${reviewCount} reviews` : ""}
      </span>
    </div>
  );
}
