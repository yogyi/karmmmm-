import { useState } from "react";
import { Package } from "lucide-react";

const FALLBACK =
  "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80";

/** Dead Unsplash IDs from older seed data → working replacements. */
const REWRITES: Record<string, string> = {
  "photo-1565814329452-7811bc438dfb":
    "https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=600&q=80",
  "photo-1584634731339-252c581abfc3":
    "https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=600&q=80",
};

export function resolveProductImageUrl(src?: string | null): string | null {
  if (!src) return null;
  for (const [deadId, replacement] of Object.entries(REWRITES)) {
    if (src.includes(deadId)) return replacement;
  }
  return src;
}

/**
 * Product photo with rewrite for known-dead URLs + graceful onError fallback.
 */
export function ProductImage({
  src,
  alt,
  className = "w-full h-full object-cover",
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  const resolved = resolveProductImageUrl(src);
  const [stage, setStage] = useState<"primary" | "fallback" | "empty">(
    resolved ? "primary" : "empty",
  );

  if (stage === "empty") {
    return (
      <div
        className="w-full h-full bg-muted flex items-center justify-center"
        role="img"
        aria-label={alt}
      >
        <Package className="text-muted-foreground" size={28} />
      </div>
    );
  }

  const url = stage === "primary" && resolved ? resolved : FALLBACK;

  return (
    <img
      src={url}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => setStage((s) => (s === "primary" ? "fallback" : "empty"))}
    />
  );
}
