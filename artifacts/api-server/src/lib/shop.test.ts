import { describe, expect, it } from "vitest";
import { isLegacyIdSlug, slugifyCompany } from "./shop";

describe("slugifyCompany", () => {
  it("builds a clean slug without database ids", () => {
    expect(slugifyCompany("Yogesh")).toBe("yogesh");
    expect(slugifyCompany("Karm Baba Mart")).toBe("karm-baba-mart");
    expect(slugifyCompany("  Acme!! Co.  ")).toBe("acme-co");
  });

  it("falls back when name has no alphanumeric characters", () => {
    expect(slugifyCompany("***")).toBe("shop");
  });
});

describe("isLegacyIdSlug", () => {
  it("detects name-{supplierId} share links", () => {
    expect(isLegacyIdSlug("yogesh-6", "Yogesh", 6)).toBe(true);
    expect(isLegacyIdSlug("yogesh", "Yogesh", 6)).toBe(false);
    expect(isLegacyIdSlug("yogesh-2", "Yogesh", 6)).toBe(false);
  });
});
