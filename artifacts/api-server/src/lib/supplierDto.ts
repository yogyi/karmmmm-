import { toNumber, type Prisma } from "@workspace/db";

export type SupplierRow = Prisma.SupplierGetPayload<object>;

/** Columns safe to expose on public list/detail/share cards. */
export const PUBLIC_SUPPLIER_SELECT = {
  id: true,
  slug: true,
  companyName: true,
  description: true,
  location: true,
  country: true,
  city: true,
  state: true,
  logoUrl: true,
  coverUrl: true,
  videoUrl: true,
  shareImageUrl: true,
  verified: true,
  yearsInBusiness: true,
  employeeCount: true,
  mainProducts: true,
  certifications: true,
  rating: true,
  reviewCount: true,
  productCount: true,
  responseRate: true,
  responseTime: true,
  website: true,
  createdAt: true,
} as const satisfies Prisma.SupplierSelect;

export type PublicSupplierRow = Prisma.SupplierGetPayload<{
  select: typeof PUBLIC_SUPPLIER_SELECT;
}>;

const SENSITIVE_KEYS = [
  "gstin",
  "pan",
  "contactPhone",
  "contactEmail",
  "contactPerson",
  "bankAccountName",
  "bankIfsc",
  "bankAccountNumber",
] as const;

/** Owner/admin DTO — includes verification + payout fields. */
export function mapOwnerSupplier(s: SupplierRow) {
  return {
    ...s,
    rating: toNumber(s.rating) ?? 0,
    responseRate: toNumber(s.responseRate),
    mainProducts: s.mainProducts ?? [],
    certifications: s.certifications ?? [],
    createdAt: s.createdAt.toISOString(),
    verifiedAt: s.verifiedAt ? s.verifiedAt.toISOString() : null,
  };
}

/** Public-safe card fields — never includes GST / PAN / bank / phones. */
export function mapPublicSupplier(s: PublicSupplierRow | SupplierRow) {
  return {
    id: s.id,
    slug: s.slug,
    companyName: s.companyName,
    description: s.description,
    location: s.location,
    country: s.country,
    city: "city" in s ? s.city : null,
    state: "state" in s ? s.state : null,
    logoUrl: s.logoUrl,
    coverUrl: s.coverUrl,
    videoUrl: "videoUrl" in s ? s.videoUrl : null,
    shareImageUrl: "shareImageUrl" in s ? s.shareImageUrl : null,
    verified: s.verified,
    yearsInBusiness: s.yearsInBusiness,
    employeeCount: s.employeeCount,
    mainProducts: s.mainProducts ?? [],
    certifications: s.certifications ?? [],
    rating: toNumber(s.rating) ?? 0,
    reviewCount: s.reviewCount,
    productCount: s.productCount,
    responseRate: toNumber(s.responseRate),
    responseTime: s.responseTime,
    website: "website" in s ? s.website : null,
    createdAt: s.createdAt.toISOString(),
  };
}

/** Test helper — ensures a mapped public DTO never carries secrets. */
export function assertNoSensitiveSupplierFields(dto: Record<string, unknown>): void {
  for (const key of SENSITIVE_KEYS) {
    if (key in dto && dto[key] != null) {
      throw new Error(`Public supplier DTO leaked sensitive field: ${key}`);
    }
  }
}
