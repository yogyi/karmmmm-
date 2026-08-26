import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Profile photo with graceful fallback when production 404s a local-only
 * `/api/storage/...` URL (files uploaded before Vercel Blob was wired).
 */
export function UserAvatar({
  src,
  fallbackSrc,
  name,
  className,
  imgClassName,
}: {
  src?: string | null;
  /** e.g. Clerk imageUrl when DB avatar fails to load */
  fallbackSrc?: string | null;
  name?: string | null;
  className?: string;
  imgClassName?: string;
}) {
  const initials = (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";

  const candidates = [src, fallbackSrc].filter(
    (u, i, arr): u is string => Boolean(u) && arr.indexOf(u) === i,
  );
  const [index, setIndex] = useState(0);
  useEffect(() => {
    setIndex(0);
  }, [src, fallbackSrc]);
  const current = candidates[index];

  if (!current) {
    return (
      <span
        className={cn(
          "rounded-full bg-primary text-white text-xs font-semibold flex items-center justify-center flex-shrink-0",
          className,
        )}
        aria-hidden
      >
        {initials}
      </span>
    );
  }

  return (
    <img
      key={current}
      src={current}
      alt=""
      className={cn(
        "rounded-full object-cover border border-border flex-shrink-0",
        className,
        imgClassName,
      )}
      referrerPolicy="no-referrer"
      onError={() => {
        if (index + 1 < candidates.length) setIndex(index + 1);
        else setIndex(candidates.length); // exhaust → initials on next render
      }}
    />
  );
}
