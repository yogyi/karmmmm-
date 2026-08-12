import { describe, expect, it } from "vitest";
import {
  computeGstinChecksum,
  normalizeGstin,
  validateGstin,
} from "./gstin";

describe("GSTIN validation", () => {
  it("normalizes whitespace and case", () => {
    expect(normalizeGstin(" 27aapfu0939f1zv ")).toBe("27AAPFU0939F1ZV");
  });

  it("rejects empty / wrong length", () => {
    expect(validateGstin("").ok).toBe(false);
    expect(validateGstin("27AAPFU0939F1Z").ok).toBe(false);
  });

  it("accepts a checksum-valid GSTIN", () => {
    // Build a valid GSTIN: state 27 + fake PAN + 1Z + checksum
    const first14 = "27AAPFU0939F1Z";
    const check = computeGstinChecksum(first14);
    const gstin = first14 + check;
    const result = validateGstin(gstin);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.pan).toBe("AAPFU0939F");
      expect(result.stateCode).toBe("27");
    }
  });

  it("rejects bad checksum", () => {
    const result = validateGstin("27AAPFU0939F1Z0");
    // May fail format or checksum depending on char — force known bad
    const first14 = "27AAPFU0939F1Z";
    const good = computeGstinChecksum(first14);
    const bad = good === "0" ? "1" : "0";
    expect(validateGstin(first14 + bad).ok).toBe(false);
  });
});
