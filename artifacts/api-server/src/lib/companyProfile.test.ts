import { describe, expect, it } from "vitest";
import {
  firstCompanyProfileError,
  isValidCityName,
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

  it("rejects Morocco profile with gibberish city / numeric region / bad postal", () => {
    const bad = validateCompanyProfile({
      companyName: "Atlas Trade",
      legalName: "Atlas Trade SARL",
      businessAddress: "Plot 42, GIDC Pandesara, Near Ring Road",
      city: "dcedcw",
      state: "1123",
      pincode: "1214",
      country: "Morocco",
    });
    expect(bad.city).toBeTruthy();
    expect(bad.state).toBeTruthy();
    expect(bad.pincode).toBeTruthy();
    expect(bad.businessAddress).toMatch(/India/i);
  });

  it("accepts a plausible Morocco profile", () => {
    expect(isValidCityName("Casablanca")).toBe(true);
    expect(
      validateCompanyProfile({
        companyName: "Atlas Trade",
        legalName: "Atlas Trade SARL",
        businessAddress: "12 Boulevard Zerktouni, Maarif",
        city: "Casablanca",
        state: "Casablanca-Settat",
        pincode: "20000",
        country: "Morocco",
      }),
    ).toEqual({});
  });

  it("rejects US ZIP that does not match format", () => {
    const err = validateCompanyProfile({
      companyName: "Acme Inc",
      legalName: "Acme Incorporated",
      businessAddress: "100 Main Street Suite 4",
      city: "Austin",
      state: "Texas",
      pincode: "1214",
      country: "United States",
    });
    expect(err.pincode).toMatch(/ZIP/i);
  });
});
