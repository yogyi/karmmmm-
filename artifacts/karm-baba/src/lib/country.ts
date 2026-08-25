/** Normalize country strings for India vs foreign KYC rules. */
export function isIndiaCountry(country: string | null | undefined): boolean {
  const c = (country ?? "").trim().toLowerCase();
  if (!c) return true;
  return (
    c === "india" ||
    c === "in" ||
    c === "bharat" ||
    c === "hindustan" ||
    c.startsWith("india ")
  );
}

/** India: 10-digit mobile starting 6–9. Foreign: international-ish digits. */
export function isValidContactPhone(
  phone: string,
  country: string | null | undefined,
): boolean {
  const raw = phone.trim();
  if (isIndiaCountry(country)) {
    return /^[6-9]\d{9}$/.test(raw);
  }
  const digits = raw.replace(/[\s()-]/g, "");
  return /^\+?\d{8,15}$/.test(digits);
}

export const COUNTRY_OPTIONS = [
  "India",
  "United Arab Emirates",
  "Saudi Arabia",
  "Qatar",
  "Kuwait",
  "Bahrain",
  "Oman",
  "Egypt",
  "Nigeria",
  "Kenya",
  "South Africa",
  "Ghana",
  "Morocco",
  "United States",
  "Canada",
  "United Kingdom",
  "Singapore",
  "China",
  "Bangladesh",
  "Sri Lanka",
  "Nepal",
  "Germany",
  "France",
  "Australia",
  "Other",
] as const;
