/**
 * WhatsApp dial-code helpers (API).
 * Keep in sync with karm-baba/src/lib/phoneDialCodes.ts
 */

export type DialCodeOption = {
  country: string;
  dial: string;
  iso: string;
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
  const digits = country.replace(/\D/g, "");
  const byDial = digits ? PHONE_DIAL_CODES.find((d) => d.dial === digits) : null;
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

function nationalDigits(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("0")) d = d.slice(1);
  return d;
}

/** Build E.164 from local number + country name/dial, or full international input. */
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

  const rawDigits = trimmed.replace(/[^\d+]/g, "");
  if (rawDigits.startsWith("+") || trimmed.startsWith("+")) {
    const only = rawDigits.replace(/\D/g, "");
    if (only.length < 8 || only.length > 15) return null;
    return `+${only}`;
  }

  let local = nationalDigits(trimmed);
  if (!local) return null;

  if (dialOpt) {
    if (local.startsWith(dialOpt.dial) && local.length > dialOpt.localMax) {
      local = local.slice(dialOpt.dial.length);
    }
    const combined = `${dialOpt.dial}${local}`;
    if (combined.length < 8 || combined.length > 15) return null;
    return `+${combined}`;
  }

  if (local.length < 8 || local.length > 15) return null;
  return `+${local}`;
}
