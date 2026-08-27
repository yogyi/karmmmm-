import { describe, expect, it } from "vitest";
import {
  assertNoSensitiveSupplierFields,
  hasGstApiVerifiedBadge,
  mapPublicSupplier,
} from "./supplierDto";

const sample = {
  id: 1,
  slug: "acme",
  companyName: "Acme",
  description: "Desc",
  location: "Surat, Gujarat",
  country: "India",
  city: "Surat",
  state: "Gujarat",
  logoUrl: null,
  coverUrl: null,
  videoUrl: null,
  shareImageUrl: null,
  verified: true,
  gstVerified: true,
  gstLiveVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
  yearsInBusiness: 10,
  employeeCount: "50-100",
  mainProducts: ["Cotton"],
  certifications: ["ISO"],
  rating: "4.5" as unknown as { toString(): string },
  reviewCount: 12,
  productCount: 3,
  responseRate: "90" as unknown as { toString(): string },
  responseTime: "< 2h",
  website: "https://example.com",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  // Secrets that must never appear on public DTOs
  gstin: "24AAAAA0000A1Z5",
  pan: "AAAAA0000A",
  contactPhone: "9876543210",
  contactEmail: "secret@example.com",
  contactPerson: "Owner",
  bankAccountName: "Acme Pvt Ltd",
  bankIfsc: "HDFC0001234",
  bankAccountNumber: "1234567890",
};

describe("mapPublicSupplier", () => {
  it("omits GSTIN, PAN, bank, and contact secrets", () => {
    const dto = mapPublicSupplier(sample as never);
    expect(dto.companyName).toBe("Acme");
    expect(dto).not.toHaveProperty("gstin");
    expect(dto).not.toHaveProperty("pan");
    expect(dto).not.toHaveProperty("contactPhone");
    expect(dto).not.toHaveProperty("contactEmail");
    expect(dto).not.toHaveProperty("bankAccountName");
    expect(dto).not.toHaveProperty("bankIfsc");
    expect(dto).not.toHaveProperty("bankAccountNumber");
    expect(dto).not.toHaveProperty("gstVerified");
    expect(dto).not.toHaveProperty("gstLiveVerifiedAt");
    assertNoSensitiveSupplierFields(dto as Record<string, unknown>);
  });

  it("shows Verified badge only after GST API live check", () => {
    expect(mapPublicSupplier(sample as never).verified).toBe(true);
    expect(
      mapPublicSupplier({
        ...sample,
        verified: true,
        gstVerified: false,
        gstLiveVerifiedAt: null,
      } as never).verified,
    ).toBe(false);
    expect(
      hasGstApiVerifiedBadge({
        gstVerified: false,
        gstLiveVerifiedAt: new Date(),
      }),
    ).toBe(true);
  });
});
