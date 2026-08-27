import { describe, expect, it } from "vitest";
import {
  assertNoSensitiveSupplierFields,
  hasGstApiVerifiedBadge,
  mapPublicSupplier,
} from "./supplierDto";
import {
  gstCertificateMatchesEntered,
  normalizeOcrDocumentPayload,
  parseGstCertificateOcrPayload,
} from "./gstCertificateOcr";

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
  gstCertificateOcrVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
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
    assertNoSensitiveSupplierFields(dto as Record<string, unknown>);
  });

  it("shows Verified badge only after GST certificate OCR", () => {
    expect(mapPublicSupplier(sample as never).verified).toBe(true);
    expect(
      mapPublicSupplier({
        ...sample,
        verified: true,
        gstVerified: true,
        gstLiveVerifiedAt: new Date(),
        gstCertificateOcrVerifiedAt: null,
      } as never).verified,
    ).toBe(false);
    expect(
      hasGstApiVerifiedBadge({
        gstCertificateOcrVerifiedAt: new Date(),
      }),
    ).toBe(true);
  });
});

describe("gst certificate OCR helpers", () => {
  it("parses common OCR payloads and matches GSTIN", () => {
    const fields = parseGstCertificateOcrPayload({
      status: "completed",
      result: { gstin: "27AAPFU0939F1ZV", legal_name: "ACME PVT LTD" },
    });
    expect(fields.gstin).toBe("27AAPFU0939F1ZV");
    expect(gstCertificateMatchesEntered(fields.gstin, "27AAPFU0939F1ZV")).toBe(true);
    expect(gstCertificateMatchesEntered(fields.gstin, "29AAAAA0000A1Z5")).toBe(false);
  });

  it("normalizes data URLs to raw base64 and allows PDF", () => {
    const ok = normalizeOcrDocumentPayload(
      "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
    );
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.kind).toBe("base64");
      expect(ok.value).toBe("/9j/4AAQSkZJRg==");
      expect(ok.isPdf).toBe(false);
    }
    const pdf = normalizeOcrDocumentPayload("data:application/pdf;base64,JVBERi0=");
    expect(pdf.ok).toBe(true);
    if (pdf.ok) {
      expect(pdf.isPdf).toBe(true);
      expect(pdf.value).toBe("JVBERi0=");
    }
  });
});
