/**
 * Copy helpers for supplier summary cards — keep UI strings consistent.
 */

export function formatProductCount(count: number | null | undefined): string {
  const n =
    typeof count === "number" && Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  return n === 1 ? "1 product" : `${n} products`;
}

/** Returns null when years are missing/invalid so the UI can omit the field. */
export function formatYearsInBusiness(
  years: number | null | undefined,
): string | null {
  if (years == null || !Number.isFinite(years) || years <= 0) return null;
  const y = Math.floor(years);
  return y === 1 ? "1 yr in business" : `${y} yr in business`;
}

export type SupplierCardData = {
  id: number;
  companyName: string;
  location: string;
  logoUrl?: string | null;
  verified?: boolean;
  rating: number;
  reviewCount: number;
  productCount: number;
  yearsInBusiness?: number | null;
};
