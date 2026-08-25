import { describe, expect, it } from "vitest";
import {
  firstCompanyProfileError,
  isValidIndianPincode,
  normalizeIndianState,
  validateCompanyProfile,
} from "./companyProfile";

const base = {
  companyName: "Gujarat Textile Mills",
  legalName: "Gujarat Textile Mills Private Limited",
  businessAddress: "Plot 42, GIDC Pandesara, Near Ring Road",
  city: "Surat",
  state: "Gujarat",
  pincode: "395003",
  country: "India",
};

describe("company profile validation", () => {
  it("accepts a valid Indian profile (case-insensitive state)", () => {
    expect(
      validateCompanyProfile({ ...base, city: "surat", state: "gujarat" }),
    ).toEqual({});
    expect(normalizeIndianState("gujarat")).toBe("Gujarat");
  });

  it("requires valid 6-digit PIN for India", () => {
    expect(isValidIndianPincode("395003")).toBe(true);
    expect(isValidIndianPincode("095003")).toBe(false);
    expect(validateCompanyProfile({ ...base, pincode: "" }).pincode).toBeTruthy();
    expect(validateCompanyProfile({ ...base, pincode: "12345" }).pincode).toBeTruthy();
  });

  it("rejects unknown Indian state", () => {
    expect(validateCompanyProfile({ ...base, state: "Narnia" }).state).toBeTruthy();
  });

  it("rejects tiny address / non-letter city", () => {
    expect(
      validateCompanyProfile({ ...base, businessAddress: "Plot 1" }).businessAddress,
    ).toBeTruthy();
    expect(validateCompanyProfile({ ...base, city: "12" }).city).toBeTruthy();
  });

  it("returns a first error message helper", () => {
    expect(firstCompanyProfileError({ ...base, companyName: "" })).toMatch(/required/i);
  });
});
