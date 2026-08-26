import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeroProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  compact?: boolean;
}

/** Branded navy → orange page banner (share-card language). */
export function PageHero({
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
  compact,
}: PageHeroProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden text-white",
        compact ? "py-7 sm:py-8" : "py-9 sm:py-11",
        className,
      )}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, hsl(220 60% 14%) 0%, hsl(220 55% 24%) 46%, hsl(28 90% 40%) 155%)",
        }}
      />
      <div
        className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full opacity-35"
        style={{
          background: "radial-gradient(circle, hsl(28 100% 60%) 0%, transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute -left-10 bottom-0 h-48 w-48 rounded-full opacity-20"
        style={{
          background: "radial-gradient(circle, #fff 0%, transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-20 mix-blend-overlay"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, transparent, transparent 12px, rgba(255,255,255,0.06) 12px, rgba(255,255,255,0.06) 13px)",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-3 sm:px-4 min-w-0">
        {eyebrow ? (
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/55 font-semibold mb-2">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-heading text-xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-balance break-words">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 text-sm sm:text-base text-white/70 max-w-2xl leading-relaxed">
            {description}
          </p>
        ) : null}
        {actions ? (
          <div className="mt-5 flex flex-wrap gap-2.5 min-w-0">{actions}</div>
        ) : null}
        {children}
      </div>
    </section>
  );
}
