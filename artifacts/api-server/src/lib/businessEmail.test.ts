import { describe, expect, it } from "vitest";
import {
  emailMatchesWebsite,
  isFreeEmailDomain,
  validateBusinessEmail,
  validateOptionalWebsite,
  websiteHost,
} from "./businessEmail";

describe("validateBusinessEmail", () => {
  it("accepts company domain email", () => {
    const r = validateBusinessEmail("ahmed@alfuttaim.ae");
    expect(r).toEqual({
      ok: true,
      email: "ahmed@alfuttaim.ae",
      domain: "alfuttaim.ae",
    });
  });

  it("rejects Gmail / Yahoo", () => {
    expect(validateBusinessEmail("x@gmail.com").ok).toBe(false);
    expect(validateBusinessEmail("x@yahoo.com").ok).toBe(false);
    expect(validateBusinessEmail("x@outlook.com").ok).toBe(false);
  });

  it("requires match when website is set", () => {
    expect(
      validateBusinessEmail("ahmed@alfuttaim.ae", "https://www.alfuttaim.ae").ok,
    ).toBe(true);
    expect(
      validateBusinessEmail("ahmed@other.ae", "https://www.alfuttaim.ae").ok,
    ).toBe(false);
  });
});

describe("helpers", () => {
  it("detects free domains", () => {
    expect(isFreeEmailDomain("gmail.com")).toBe(true);
    expect(isFreeEmailDomain("alfuttaim.ae")).toBe(false);
  });

  it("parses website host", () => {
    expect(websiteHost("https://www.alfuttaim.ae/about")).toBe("alfuttaim.ae");
    expect(emailMatchesWebsite("a@alfuttaim.ae", "https://shop.alfuttaim.ae")).toBe(
      true,
    );
  });

  it("validateOptionalWebsite rejects garbage hosts", () => {
    expect(validateOptionalWebsite("").ok).toBe(true);
    expect(validateOptionalWebsite("https://gujtextilemills.com").ok).toBe(true);
    expect(validateOptionalWebsite("www.com").ok).toBe(false);
    expect(validateOptionalWebsite("not a url").ok).toBe(false);
    expect(validateOptionalWebsite("https://example.com").ok).toBe(false);
    expect(validateOptionalWebsite("https://yourcompany.com").ok).toBe(false);
  });

  it("does not treat www.com as matching a .com email", () => {
    expect(emailMatchesWebsite("yogeshmehta@karmbaba.com", "www.com")).toBe(false);
    expect(validateBusinessEmail("yogeshmehta@karmbaba.com", "www.com").ok).toBe(false);
    expect(validateBusinessEmail("yogeshmehta@karmbaba.com", "https://karmbaba.com").ok).toBe(
      true,
    );
    expect(validateBusinessEmail("yogeshmehta@karmbaba.com", "").ok).toBe(true);
  });
});

describe("validateRegistrationNumber / buyer company profile", () => {
  it("rejects garbage registration numbers like gafbae", async () => {
    const { validateRegistrationNumber, validateBuyerCompanyProfile } = await import(
      "./businessEmail"
    );
    expect(validateRegistrationNumber("gafbae").ok).toBe(false);
    expect(validateRegistrationNumber("asdfgh").ok).toBe(false);
    expect(validateRegistrationNumber("12345").ok).toBe(false);
    expect(validateRegistrationNumber("test").ok).toBe(false);
    expect(validateRegistrationNumber("CR-1234567").ok).toBe(true);
    expect(validateRegistrationNumber("87451239").ok).toBe(true);
    expect(validateRegistrationNumber("12345678").ok).toBe(false);

    const bad = validateBuyerCompanyProfile({
      country: "United Arab Emirates",
      registrationNumber: "gafbae",
      website: "https://example.com",
      email: "a@realco.ae",
    });
    expect(bad.registrationNumber).toBeTruthy();
    expect(bad.website).toBeTruthy();

    const good = validateBuyerCompanyProfile({
      country: "United Arab Emirates",
      registrationNumber: "CN-1234567",
      website: "https://realco.ae",
      email: "a@realco.ae",
    });
    expect(good).toEqual({});
  });
});
