import { describe, expect, it } from "vitest";
import {
  emailMatchesWebsite,
  isFreeEmailDomain,
  validateBusinessEmail,
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
});
