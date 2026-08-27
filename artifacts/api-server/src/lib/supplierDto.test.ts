import { describe, expect, it } from "vitest";
import {
  assertNoSensitiveSupplierFields,
  hasGstApiVerifiedBadge,
  mapPublicSupplier,
} from "./supplierDto";
import {
  assertGstCertificateOcrAuthentic,
  gstCertificateMatchesEntered,
  gstCertificateNameConsistentWithLive,
  normalizeOcrDocumentPayload,
  parseGstCertificateOcrPayload,
} from "./gstCertificateOcr";
import { gstinClashError, isGstinUniqueViolation } from "./gstinClash";

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

  it("rejects random PDFs that are not GST registration certificates", () => {
    const junk = assertGstCertificateOcrAuthentic(
      {
        gstin: null,
        legalName: null,
        tradeName: null,
        address: null,
        pan: null,
        status: null,
      },
      { status: "completed", text: "Invoice #123 paid thank you" },
    );
    expect(junk.ok).toBe(false);

    const noName = assertGstCertificateOcrAuthentic(
      {
        gstin: "27AAPFU0939F1ZV",
        legalName: null,
        tradeName: null,
        address: null,
        pan: null,
        status: null,
      },
      { result: { gstin: "27AAPFU0939F1ZV" } },
    );
    expect(noName.ok).toBe(false);

    // Structured fields alone must NOT pass without GST certificate markers.
    const structuredOnly = assertGstCertificateOcrAuthentic(
      {
        gstin: "27AAPFU0939F1ZV",
        legalName: "ACME TRADING PRIVATE LIMITED",
        tradeName: "ACME",
        address: "Mumbai",
        pan: "AAPFU0939F",
        status: "Active",
      },
      {
        result: {
          gstin: "27AAPFU0939F1ZV",
          legal_name: "ACME TRADING PRIVATE LIMITED",
          trade_name: "ACME",
          address: "Mumbai",
          pan: "AAPFU0939F",
          status: "Active",
        },
      },
    );
    expect(structuredOnly.ok).toBe(false);

    const real = assertGstCertificateOcrAuthentic(
      {
        gstin: "27AAPFU0939F1ZV",
        legalName: "ACME TRADING PRIVATE LIMITED",
        tradeName: "ACME",
        address: "Mumbai",
        pan: "AAPFU0939F",
        status: "Active",
      },
      {
        result: {
          extraction_output: {
            document_type: "GST Registration Certificate",
            legal_name: "ACME TRADING PRIVATE LIMITED",
            gstin: "27AAPFU0939F1ZV",
            form: "Form GST REG-06",
          },
        },
      },
    );
    expect(real.ok).toBe(true);
  });

  it("checks OCR legal/trade name against live GSTN names", () => {
    expect(
      gstCertificateNameConsistentWithLive({
        ocrLegalName: "ACME TRADING PRIVATE LIMITED",
        ocrTradeName: null,
        liveLegalName: "Acme Trading Pvt Ltd",
        liveTradeName: null,
      }),
    ).toBe(true);
    expect(
      gstCertificateNameConsistentWithLive({
        ocrLegalName: "TOTALLY DIFFERENT CO",
        ocrTradeName: null,
        liveLegalName: "Acme Trading Private Limited",
        liveTradeName: null,
      }),
    ).toBe(false);
    expect(
      gstCertificateNameConsistentWithLive({
        ocrLegalName: null,
        ocrTradeName: "ACME",
        liveLegalName: null,
        liveTradeName: "Acme",
      }),
    ).toBe(true);
  });

  it("detects GSTIN unique violations and formats clash errors", () => {
    expect(gstinClashError("Acme")).toContain("Acme");
    expect(
      isGstinUniqueViolation(
        Object.assign(new Error("Unique constraint failed on gstin"), {
          code: "P2002",
          meta: { target: ["gstin"] },
        }),
      ),
    ).toBe(true);
    expect(isGstinUniqueViolation(new Error("nope"))).toBe(false);
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
