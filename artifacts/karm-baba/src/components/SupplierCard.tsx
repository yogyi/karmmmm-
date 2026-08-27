import { ArrowRight, BadgeCheck, MapPin, Package } from "lucide-react";
import { StarRating } from "@/components/StarRating";
import {
  formatProductCount,
  formatYearsInBusiness,
  type SupplierCardData,
} from "@/lib/supplierCardFormat";
import { cn } from "@/lib/utils";

const FALLBACK_GRADIENTS = [
  "from-secondary to-secondary/80",
  "from-primary to-amber-500",
  "from-emerald-600 to-teal-500",
  "from-slate-700 to-slate-500",
];

type SupplierCardProps = {
  supplier: SupplierCardData;
  /** Used to pick a stable fallback avatar gradient when no logo. */
  index?: number;
  className?: string;
  onClick?: () => void;
};

/**
 * Equal-height supplier card — soft header wash, clear hierarchy, aligned CTAs.
 */
export function SupplierCard({
  supplier,
  index = 0,
  className,
  onClick,
}: SupplierCardProps) {
  const yearsLabel = formatYearsInBusiness(supplier.yearsInBusiness);
  const productsLabel = formatProductCount(supplier.productCount);
  const gradient = FALLBACK_GRADIENTS[index % FALLBACK_GRADIENTS.length];
  const initial = (supplier.companyName?.trim()?.[0] || "?").toUpperCase();

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "kb-card-interactive w-full h-full text-left flex flex-col group overflow-hidden",
        "border border-secondary/12 bg-white",
        "shadow-[0_12px_32px_-20px_rgba(26,39,68,0.5)]",
        "hover:border-primary/30 hover:shadow-[0_20px_40px_-18px_rgba(26,39,68,0.42)]",
        className,
      )}
    >
      {/* Soft header panel — depth without a hard orange line */}
      <div className="relative px-5 pt-5 pb-4 bg-gradient-to-br from-[#fff7ef] via-white to-[#f3f6fb]">
        <div
          className="pointer-events-none absolute -top-8 -right-6 h-24 w-24 rounded-full bg-primary/10 blur-2xl group-hover:bg-primary/20 transition-colors"
          aria-hidden
        />
        <div className="relative flex items-start gap-3.5">
          {supplier.logoUrl ? (
            <img
              src={supplier.logoUrl}
              alt=""
              className="w-14 h-14 rounded-2xl object-cover flex-shrink-0 border-2 border-white shadow-md bg-white ring-1 ring-secondary/10"
            />
          ) : (
            <div
              className={cn(
                "w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center flex-shrink-0 shadow-md ring-2 ring-white",
                gradient,
              )}
              aria-hidden
            >
              <span className="text-xl font-heading font-bold text-white">{initial}</span>
            </div>
          )}

          <div className="min-w-0 flex-1 pt-0.5">
            <h3 className="font-heading font-bold text-[15px] leading-snug text-secondary break-words">
              {supplier.companyName}
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
              {supplier.verified ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-emerald-800 bg-emerald-100/90 border border-emerald-200 px-1.5 py-0.5 rounded-md shadow-sm">
                  <BadgeCheck size={11} className="shrink-0" />
                  Verified
                </span>
              ) : null}
              <span className="text-xs text-secondary/65 flex items-center gap-1 min-w-0">
                <MapPin size={12} className="text-primary shrink-0" />
                <span className="break-words">{supplier.location}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col flex-1 px-5 pb-5 pt-1 gap-3.5 min-h-0">
        <StarRating rating={supplier.rating} reviewCount={supplier.reviewCount} size={13} />

        <div className="flex flex-wrap gap-2 min-h-[2rem] content-start">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fff4e8] border border-orange-200/80 px-2.5 py-1 text-xs font-semibold text-secondary">
            <Package size={12} className="text-primary shrink-0" />
            {productsLabel}
          </span>
          {yearsLabel ? (
            <span className="inline-flex items-center rounded-full bg-secondary/[0.05] border border-secondary/10 px-2.5 py-1 text-xs font-semibold text-secondary">
              {yearsLabel}
            </span>
          ) : null}
        </div>

        <div className="flex-1 min-h-2" aria-hidden />

        <div className="grid grid-cols-2 gap-2.5">
          <span className="inline-flex items-center justify-center gap-1 min-h-10 rounded-xl border border-secondary/15 bg-[#f7f8fb] text-xs font-semibold text-secondary group-hover:border-primary/35 group-hover:bg-white group-hover:text-primary transition-colors">
            View profile
            <ArrowRight size={13} className="opacity-70 group-hover:translate-x-0.5 transition-transform" />
          </span>
          <span className="inline-flex items-center justify-center min-h-10 rounded-xl bg-primary text-xs font-semibold text-white shadow-[0_8px_18px_-10px_rgba(255,122,0,0.7)] group-hover:bg-primary/90 transition-colors">
            Request quote
          </span>
        </div>
      </div>
    </button>
  );
}
