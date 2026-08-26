import { useState } from "react";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

const FALLBACK =
  "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80";

/** Wrong / dead Unsplash IDs from older seed data → product-matching replacements. */
const REWRITES: Record<string, string> = {
  // old LED / fabric mixups
  "photo-1494438639946-1ebd1d20bf85":
    "https://images.unsplash.com/photo-1524484483546-6f9ac825bc1f?auto=format&fit=crop&w=600&q=80",
  "photo-1565814329452-7811bc438dfb":
    "https://images.unsplash.com/photo-1524484483546-6f9ac825bc1f?auto=format&fit=crop&w=600&q=80",
  // gloves was pills blister pack
  "photo-1584308666744-24d5c474f2ae":
    "https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=600&q=80",
  "photo-1584634731339-252c581abfc3":
    "https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=600&q=80",
  // CNC was car / garage
  "photo-1565043589221-1a6fd9ae45c7":
    "https://images.unsplash.com/photo-1537462715879-360eeb61a0ad?auto=format&fit=crop&w=600&q=80",
};

export function resolveProductImageUrl(src?: string | null): string | null {
  if (!src) return null;
  for (const [deadId, replacement] of Object.entries(REWRITES)) {
    if (src.includes(deadId)) return replacement;
  }
  return src;
}

/**
 * Product photo with rewrite for known-wrong URLs + graceful onError fallback.
 *
 * `fill` (default): absolutely covers a positioned parent — use inside
 * `.kb-product-media` or any `relative overflow-hidden` box with a fixed height.
 * `fill={false}`: normal flow image for fixed-size thumbs (list rows, etc.).
 */
export function ProductImage({
  src,
  alt,
  className,
  fill = true,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  /** Absolute fill of parent — keeps catalog cards flush with rounded corners. */
  fill?: boolean;
}) {
  const resolved = resolveProductImageUrl(src);
  const [stage, setStage] = useState<"primary" | "fallback" | "empty">(
    resolved ? "primary" : "empty",
  );

  if (stage === "empty") {
    return (
      <div
        className={cn(
          "bg-muted flex items-center justify-center text-muted-foreground",
          fill ? "absolute inset-0" : "h-full w-full",
        )}
        role="img"
        aria-label={alt}
      >
        <Package size={fill ? 28 : 20} />
      </div>
    );
  }

  const url = stage === "primary" && resolved ? resolved : FALLBACK;

  return (
    <img
      src={url}
      alt={alt}
      className={cn(
        "m-0 border-0 p-0 object-cover object-center",
        fill
          ? "absolute inset-0 block h-full w-full max-w-none"
          : "block h-full w-full max-w-full",
        className,
      )}
      loading="lazy"
      decoding="async"
      onError={() => setStage((s) => (s === "primary" ? "fallback" : "empty"))}
    />
  );
}
