import { Star } from "lucide-react";

interface StarRatingProps {
  rating: number;
  reviewCount?: number;
  size?: number;
}

export function StarRating({ rating, reviewCount, size = 14 }: StarRatingProps) {
  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map(i => (
          <Star
            key={i}
            size={size}
            className={i <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-gray-300"}
          />
        ))}
      </div>
      <span className="text-xs font-medium text-muted-foreground">
        {rating.toFixed(1)}
        {reviewCount !== undefined && <span className="ml-1">({reviewCount})</span>}
      </span>
    </div>
  );
}
