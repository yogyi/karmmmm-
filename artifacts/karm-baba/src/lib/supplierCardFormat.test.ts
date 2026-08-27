import { describe, expect, it } from "vitest";
import {
  formatProductCount,
  formatYearsInBusiness,
} from "./supplierCardFormat";

describe("formatProductCount", () => {
  it("pluralizes correctly", () => {
    expect(formatProductCount(0)).toBe("0 products");
    expect(formatProductCount(1)).toBe("1 product");
    expect(formatProductCount(2)).toBe("2 products");
    expect(formatProductCount(25)).toBe("25 products");
  });

  it("guards invalid values", () => {
    expect(formatProductCount(null)).toBe("0 products");
    expect(formatProductCount(undefined)).toBe("0 products");
    expect(formatProductCount(Number.NaN)).toBe("0 products");
    expect(formatProductCount(1.9)).toBe("1 product");
  });
});

describe("formatYearsInBusiness", () => {
  it("formats positive years", () => {
    expect(formatYearsInBusiness(1)).toBe("1 yr in business");
    expect(formatYearsInBusiness(25)).toBe("25 yr in business");
  });

  it("omits missing or invalid years (avoids bare 'yr in business')", () => {
    expect(formatYearsInBusiness(null)).toBeNull();
    expect(formatYearsInBusiness(undefined)).toBeNull();
    expect(formatYearsInBusiness(0)).toBeNull();
    expect(formatYearsInBusiness(-3)).toBeNull();
    expect(formatYearsInBusiness(Number.NaN)).toBeNull();
  });
});
