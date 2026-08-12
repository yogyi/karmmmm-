/**
 * Client-side GSTIN helpers (mirrors server validation).
 * Format: 22AAAAA0000A1Z5
 */

const GSTIN_REGEX =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const CHECKSUM_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function normalizeGstin(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

function computeGstinChecksum(first14: string): string {
  const code = normalizeGstin(first14).slice(0, 14);
  let factor = 1;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const codePoint = CHECKSUM_CHARS.indexOf(code[i]!);
    if (codePoint < 0) return "";
    let product = codePoint * factor;
    factor = factor === 1 ? 2 : 1;
    product = Math.floor(product / 36) + (product % 36);
    sum += product;
  }
  const checkCodePoint = (36 - (sum % 36)) % 36;
  return CHECKSUM_CHARS[checkCodePoint]!;
}

export function validateGstin(raw: string): { ok: true; gstin: string } | { ok: false; error: string } {
  const gstin = normalizeGstin(raw);
  if (!gstin) return { ok: false, error: "GSTIN is required" };
  if (gstin.length !== 15) {
    return { ok: false, error: "GSTIN must be exactly 15 characters" };
  }
  if (!GSTIN_REGEX.test(gstin)) {
    return {
      ok: false,
      error: "Invalid GSTIN format (expected e.g. 27AAPFU0939F1ZV)",
    };
  }
  if (computeGstinChecksum(gstin.slice(0, 14)) !== gstin[14]) {
    return { ok: false, error: "Invalid GSTIN checksum — check the number carefully" };
  }
  return { ok: true, gstin };
}
