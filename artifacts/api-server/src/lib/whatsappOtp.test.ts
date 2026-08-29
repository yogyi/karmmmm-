import { describe, expect, it } from "vitest";
import { normalizeWhatsappTo } from "./whatsappOtp";

describe("normalizeWhatsappTo", () => {
  it("accepts E.164 with spaces", () => {
    expect(normalizeWhatsappTo("+254 712 345 678")).toBe("+254712345678");
  });

  it("adds + when missing for full international digits", () => {
    expect(normalizeWhatsappTo("971501234567")).toBe("+971501234567");
  });

  it("prefixes India dial code for 10-digit mobiles", () => {
    expect(normalizeWhatsappTo("9876543210", "India")).toBe("+919876543210");
    expect(normalizeWhatsappTo("9876543210", "91")).toBe("+919876543210");
    expect(normalizeWhatsappTo("9876543210", "IN")).toBe("+919876543210");
  });

  it("prefixes UAE dial for local mobiles", () => {
    expect(normalizeWhatsappTo("501234567", "AE")).toBe("+971501234567");
  });

  it("does not double-prefix when number already includes dial", () => {
    expect(normalizeWhatsappTo("919876543210", "India")).toBe("+919876543210");
  });

  it("rejects too-short numbers", () => {
    expect(normalizeWhatsappTo("+123")).toBeNull();
  });
});
