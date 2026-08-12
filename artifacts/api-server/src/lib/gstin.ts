/**
 * Indian GSTIN helpers.
 * Format: 22AAAAA0000A1Z5
 *  - 2 digit state code
 *  - 10 char PAN
 *  - 1 entity number (usually 1)
 *  - Z (default)
 *  - checksum character
 */

const GSTIN_REGEX =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const CHECKSUM_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function normalizeGstin(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

export function isValidGstinFormat(gstin: string): boolean {
  return GSTIN_REGEX.test(normalizeGstin(gstin));
}

/** Compute the 15th checksum character for the first 14 chars. */
export function computeGstinChecksum(first14: string): string {
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

export function isValidGstinChecksum(gstin: string): boolean {
  const g = normalizeGstin(gstin);
  if (g.length !== 15) return false;
  return computeGstinChecksum(g.slice(0, 14)) === g[14];
}

export function extractPanFromGstin(gstin: string): string | null {
  const g = normalizeGstin(gstin);
  if (g.length < 12) return null;
  return g.slice(2, 12);
}

export type GstinValidationResult =
  | { ok: true; gstin: string; pan: string; stateCode: string }
  | { ok: false; error: string };

export function validateGstin(raw: string): GstinValidationResult {
  const gstin = normalizeGstin(raw);
  if (!gstin) {
    return { ok: false, error: "GSTIN is required" };
  }
  if (gstin.length !== 15) {
    return { ok: false, error: "GSTIN must be exactly 15 characters" };
  }
  if (!isValidGstinFormat(gstin)) {
    return {
      ok: false,
      error: "Invalid GSTIN format (expected e.g. 27AAPFU0939F1ZV)",
    };
  }
  if (!isValidGstinChecksum(gstin)) {
    return { ok: false, error: "Invalid GSTIN checksum — check the number carefully" };
  }
  return {
    ok: true,
    gstin,
    pan: extractPanFromGstin(gstin)!,
    stateCode: gstin.slice(0, 2),
  };
}

/** Map common GST state codes → names (India). */
export const GST_STATE_CODES: Record<string, string> = {
  "01": "Jammu & Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "27": "Maharashtra",
  "29": "Karnataka",
  "30": "Goa",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "36": "Telangana",
  "37": "Andhra Pradesh",
};
