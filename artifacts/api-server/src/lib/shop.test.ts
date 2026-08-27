import { describe, expect, it } from "vitest";
import {
  buildUsernameSuggestions,
  isLegacyIdSlug,
  normalizeUsername,
  slugifyCompany,
  validateUsername,
} from "./shop";

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

describe("username helpers", () => {
  it("normalizes and validates usernames", () => {
    expect(normalizeUsername(" Yogesh!! ")).toBe("yogesh");
    expect(validateUsername("ab").ok).toBe(false);
    expect(validateUsername("yogesh")).toEqual({ ok: true, username: "yogesh" });
    expect(validateUsername("admin").ok).toBe(false);
  });

  it("suggests alternate usernames when base is taken", () => {
    const taken = new Set(["yogesh", "yogesh2"]);
    const suggestions = buildUsernameSuggestions("yogesh", taken, 5);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions).not.toContain("yogesh");
    expect(suggestions).not.toContain("yogesh2");
    expect(suggestions[0]).toBe("yogesh1");
    expect(suggestions.every((s) => /^[a-z][a-z0-9_-]{2,29}$/.test(s))).toBe(true);
  });
});
