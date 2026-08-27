import { describe, expect, it } from "vitest";
import { normalizeWhatsappTo } from "./whatsappOtp";

describe("normalizeWhatsappTo", () => {
  it("accepts E.164 with spaces", () => {
    expect(normalizeWhatsappTo("+254 712 345 678")).toBe("+254712345678");
  });

  it("adds + when missing", () => {
    expect(normalizeWhatsappTo("971501234567")).toBe("+971501234567");
  });

  it("rejects too-short numbers", () => {
    expect(normalizeWhatsappTo("+123")).toBeNull();
  });
});
