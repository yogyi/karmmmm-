import { describe, expect, it } from "vitest";
import {
  normalizeIndiaMobile,
  validateIndiaBuyerProfile,
} from "@/lib/indiaBuyerProfile";

describe("normalizeIndiaMobile", () => {
  it("strips +91 and leading 0", () => {
    expect(normalizeIndiaMobile("+91 98765 43210")).toBe("9876543210");
    expect(normalizeIndiaMobile("09876543210")).toBe("9876543210");
    expect(normalizeIndiaMobile("9876543210")).toBe("9876543210");
  });
});

describe("validateIndiaBuyerProfile", () => {
  it("requires name and company", () => {
    const r = validateIndiaBuyerProfile({ name: "", company: "" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.name).toBeTruthy();
    expect(r.errors.company).toBeTruthy();
  });

  it("allows blank GSTIN and phone", () => {
    const r = validateIndiaBuyerProfile({
      name: "Yogesh Mehta",
      company: "Karm Baba Mart",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.gstin).toBeNull();
    expect(r.value.phone).toBeNull();
  });

  it("rejects invalid GSTIN when provided", () => {
    const r = validateIndiaBuyerProfile({
      name: "Yogesh Mehta",
      company: "Karm Baba Mart",
      gstin: "gafbae",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.gstin).toBeTruthy();
  });

  it("accepts checksum-valid optional GSTIN", () => {
    // Build valid GSTIN the same way as gstin.test.ts
    const CHECKSUM = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const first14 = "27AAPFU0939F1Z";
    let factor = 1;
    let sum = 0;
    for (let i = 0; i < 14; i++) {
      let product = CHECKSUM.indexOf(first14[i]!) * factor;
      factor = factor === 1 ? 2 : 1;
      product = Math.floor(product / 36) + (product % 36);
      sum += product;
    }
    const gstin = first14 + CHECKSUM[(36 - (sum % 36)) % 36]!;

    const r = validateIndiaBuyerProfile({
      name: "Yogesh Mehta",
      company: "Karm Baba Mart",
      gstin,
      phone: "9876543210",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.gstin).toBe(gstin);
    expect(r.value.phoneE164).toBe("+919876543210");
  });

  it("rejects invalid Indian mobile when provided", () => {
    const r = validateIndiaBuyerProfile({
      name: "Yogesh Mehta",
      company: "Karm Baba",
      phone: "12345",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.phone).toBeTruthy();
  });
});
