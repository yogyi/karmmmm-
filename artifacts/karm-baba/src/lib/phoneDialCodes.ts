/**
 * WhatsApp / phone dial codes for KYC OTP.
 * Keep dial codes in sync with COUNTRY_OPTIONS where possible.
 */

export type DialCodeOption = {
  country: string;
  dial: string; // digits only, no +
  iso: string;
  /** National number length hints (min–max digits after dial code). */
  localMin: number;
  localMax: number;
};

export const PHONE_DIAL_CODES: DialCodeOption[] = [
  { country: "India", dial: "91", iso: "IN", localMin: 10, localMax: 10 },
  { country: "United Arab Emirates", dial: "971", iso: "AE", localMin: 8, localMax: 9 },
  { country: "Saudi Arabia", dial: "966", iso: "SA", localMin: 8, localMax: 9 },
  { country: "Qatar", dial: "974", iso: "QA", localMin: 8, localMax: 8 },
  { country: "Kuwait", dial: "965", iso: "KW", localMin: 8, localMax: 8 },
  { country: "Bahrain", dial: "973", iso: "BH", localMin: 8, localMax: 8 },
  { country: "Oman", dial: "968", iso: "OM", localMin: 8, localMax: 8 },
  { country: "Egypt", dial: "20", iso: "EG", localMin: 9, localMax: 10 },
  { country: "Nigeria", dial: "234", iso: "NG", localMin: 8, localMax: 10 },
  { country: "Kenya", dial: "254", iso: "KE", localMin: 9, localMax: 9 },
  { country: "South Africa", dial: "27", iso: "ZA", localMin: 9, localMax: 9 },
  { country: "Ghana", dial: "233", iso: "GH", localMin: 9, localMax: 9 },
  { country: "Morocco", dial: "212", iso: "MA", localMin: 9, localMax: 9 },
  { country: "United States", dial: "1", iso: "US", localMin: 10, localMax: 10 },
  { country: "Canada", dial: "1", iso: "CA", localMin: 10, localMax: 10 },
  { country: "United Kingdom", dial: "44", iso: "GB", localMin: 9, localMax: 10 },
  { country: "Singapore", dial: "65", iso: "SG", localMin: 8, localMax: 8 },
  { country: "China", dial: "86", iso: "CN", localMin: 10, localMax: 11 },
  { country: "Bangladesh", dial: "880", iso: "BD", localMin: 8, localMax: 10 },
  { country: "Sri Lanka", dial: "94", iso: "LK", localMin: 9, localMax: 9 },
  { country: "Nepal", dial: "977", iso: "NP", localMin: 8, localMax: 10 },
  { country: "Germany", dial: "49", iso: "DE", localMin: 8, localMax: 12 },
  { country: "France", dial: "33", iso: "FR", localMin: 9, localMax: 9 },
  { country: "Australia", dial: "61", iso: "AU", localMin: 8, localMax: 9 },
  { country: "Iraq", dial: "964", iso: "IQ", localMin: 8, localMax: 10 },
  { country: "Ethiopia", dial: "251", iso: "ET", localMin: 9, localMax: 9 },
  { country: "Tanzania", dial: "255", iso: "TZ", localMin: 9, localMax: 9 },
  { country: "Uganda", dial: "256", iso: "UG", localMin: 9, localMax: 9 },
  { country: "Turkey", dial: "90", iso: "TR", localMin: 10, localMax: 10 },
];

function normCountry(country: string): string {
  return country.trim().toLowerCase();
}

export function dialCodeForCountry(country: string | null | undefined): DialCodeOption | null {
  if (!country?.trim()) return null;
  const c = normCountry(country);
  const byIso = PHONE_DIAL_CODES.find((d) => d.iso.toLowerCase() === c);
  if (byIso) return byIso;
  const byDial = PHONE_DIAL_CODES.find((d) => d.dial === country.replace(/\D/g, ""));
  if (byDial) return byDial;
  return (
    PHONE_DIAL_CODES.find(
      (d) =>
        normCountry(d.country) === c ||
        c.includes(normCountry(d.country)) ||
        normCountry(d.country).includes(c),
    ) ?? null
  );
}

/** Split saved E.164 into dial + national number for the UI. */
export function splitWhatsappE164(e164: string): { dial: string; local: string } | null {
  const digits = e164.replace(/\D/g, "");
  if (!digits) return null;
  const sorted = [...PHONE_DIAL_CODES].sort((a, b) => b.dial.length - a.dial.length);
  for (const d of sorted) {
    if (digits.startsWith(d.dial) && digits.length > d.dial.length) {
      return { dial: d.dial, local: digits.slice(d.dial.length) };
    }
  }
  return null;
}

/** Digits only from a national / local number (strips leading 0). */
export function nationalDigits(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("0")) d = d.slice(1);
  return d;
}

/**
 * Build E.164 from country dial code + local number, or pass through if already E.164.
 */
export function buildWhatsappE164(
  localOrFull: string,
  countryOrDial: string | null | undefined,
): string | null {
  const trimmed = localOrFull.trim();
  if (!trimmed) return null;

  const dialOpt =
    dialCodeForCountry(countryOrDial ?? "") ||
    PHONE_DIAL_CODES.find((d) => d.dial === String(countryOrDial ?? "").replace(/\D/g, "")) ||
    null;

  // Already has + or looks international
  const rawDigits = trimmed.replace(/[^\d+]/g, "");
  if (rawDigits.startsWith("+") || trimmed.startsWith("+")) {
    const only = rawDigits.replace(/\D/g, "");
    if (only.length < 8 || only.length > 15) return null;
    return `+${only}`;
  }

  let local = nationalDigits(trimmed);
  if (!local) return null;

  if (dialOpt) {
    // Avoid double-prefix if user pasted full number with country code
    if (local.startsWith(dialOpt.dial) && local.length > dialOpt.localMax) {
      local = local.slice(dialOpt.dial.length);
    }
    if (local.length < dialOpt.localMin || local.length > dialOpt.localMax) {
      // Soft: still allow if total E.164 length is ok
      const combined = `${dialOpt.dial}${local}`;
      if (combined.length < 8 || combined.length > 15) return null;
      return `+${combined}`;
    }
    return `+${dialOpt.dial}${local}`;
  }

  // No country — require full international digits
  if (local.length < 8 || local.length > 15) return null;
  return `+${local}`;
}
