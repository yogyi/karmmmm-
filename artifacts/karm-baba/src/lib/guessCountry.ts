import { COUNTRY_OPTIONS } from "@/lib/country";

/** Map ISO country code or common API names to our dropdown values. */
const ISO_TO_OPTION: Record<string, string> = {
  IN: "India",
  AE: "United Arab Emirates",
  SA: "Saudi Arabia",
  QA: "Qatar",
  KW: "Kuwait",
  BH: "Bahrain",
  OM: "Oman",
  EG: "Egypt",
  NG: "Nigeria",
  KE: "Kenya",
  ZA: "South Africa",
  GH: "Ghana",
  MA: "Morocco",
  US: "United States",
  CA: "Canada",
  GB: "United Kingdom",
  SG: "Singapore",
  CN: "China",
  BD: "Bangladesh",
  LK: "Sri Lanka",
  NP: "Nepal",
  DE: "Germany",
  FR: "France",
  AU: "Australia",
  IQ: "Iraq",
  ET: "Ethiopia",
  TZ: "Tanzania",
  UG: "Uganda",
  TR: "Turkey",
};

function normalizeGuess(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  if (ISO_TO_OPTION[upper]) return ISO_TO_OPTION[upper];
  const direct = (COUNTRY_OPTIONS as readonly string[]).find(
    (c) => c.toLowerCase() === trimmed.toLowerCase(),
  );
  if (direct) return direct;
  const fuzzy = (COUNTRY_OPTIONS as readonly string[]).find((c) =>
    trimmed.toLowerCase().includes(c.toLowerCase()),
  );
  return fuzzy ?? trimmed;
}

/**
 * Best-effort country from IP (ipapi.co). Returns a COUNTRY_OPTIONS value or custom name.
 * Fails silently — never blocks the form.
 */
export async function guessUserCountry(): Promise<string | null> {
  try {
    const res = await fetch("https://ipapi.co/json/", {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      country_name?: string;
      country_code?: string;
    };
    if (data.country_code) {
      const mapped = normalizeGuess(data.country_code);
      if (mapped) return mapped;
    }
    if (data.country_name) {
      return normalizeGuess(data.country_name);
    }
    return null;
  } catch {
    return null;
  }
}
