/**
 * Company profile field validation (step 1).
 * Keep in sync with karm-baba/src/lib/companyProfile.ts
 */

import { isIndiaCountry } from "./country";

export const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu & Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
] as const;

const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut",
  "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
  "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan",
  "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada",
  "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina",
  "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island",
  "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont",
  "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming",
  "District of Columbia", "DC",
] as const;

const CANADA_PROVINCES = [
  "Alberta", "British Columbia", "Manitoba", "New Brunswick",
  "Newfoundland and Labrador", "Northwest Territories", "Nova Scotia", "Nunavut",
  "Ontario", "Prince Edward Island", "Quebec", "Saskatchewan", "Yukon",
  "AB", "BC", "MB", "NB", "NL", "NT", "NS", "NU", "ON", "PE", "QC", "SK", "YT",
] as const;

const UAE_EMIRATES = [
  "Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah",
  "Fujairah", "UAQ", "RAK",
] as const;

const MOROCCO_REGIONS = [
  "Casablanca-Settat", "Rabat-Salé-Kénitra", "Rabat-Sale-Kenitra",
  "Marrakech-Safi", "Fès-Meknès", "Fes-Meknes", "Tanger-Tétouan-Al Hoceïma",
  "Tanger-Tetouan-Al Hoceima", "Oriental", "Béni Mellal-Khénifra",
  "Beni Mellal-Khenifra", "Drâa-Tafilalet", "Draa-Tafilalet",
  "Souss-Massa", "Guelmim-Oued Noun", "Laâyoune-Sakia El Hamra",
  "Laayoune-Sakia El Hamra", "Dakhla-Oued Ed-Dahab",
  "Casablanca", "Rabat", "Marrakech", "Fes", "Fès", "Tangier", "Tanger",
  "Agadir", "Meknes", "Meknès", "Oujda",
] as const;

const STATE_ALIASES: Record<string, string> = {
  orissa: "Odisha",
  uttaranchal: "Uttarakhand",
  pondicherry: "Puducherry",
  "nct of delhi": "Delhi",
  "new delhi": "Delhi",
  "jammu and kashmir": "Jammu & Kashmir",
  "jammu & kashmir": "Jammu & Kashmir",
  "daman and diu": "Dadra and Nagar Haveli and Daman and Diu",
  "dadra and nagar haveli": "Dadra and Nagar Haveli and Daman and Diu",
};

export type CompanyProfileInput = {
  companyName: string;
  legalName: string;
  businessAddress: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  location?: string;
  yearsInBusiness?: string;
};

export type FieldErrors = Partial<
  Record<
    | "companyName"
    | "legalName"
    | "businessAddress"
    | "city"
    | "state"
    | "pincode"
    | "country"
    | "yearsInBusiness",
    string
  >
>;

function hasLetter(s: string): boolean {
  return /[a-zA-Z\u00C0-\u024F]/.test(s);
}

function normKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .replace(/&/g, "and");
}

function countryKey(country: string): string {
  return normKey(country);
}

function matchesCountry(country: string, ...names: string[]): boolean {
  const c = countryKey(country);
  return names.some((n) => {
    const k = normKey(n);
    return c === k || c.includes(k);
  });
}

function inNamedList(raw: string, list: readonly string[]): boolean {
  const key = normKey(raw);
  if (!key) return false;
  return list.some((name) => {
    const n = normKey(name);
    return key === n || key.includes(n) || n.includes(key);
  });
}

export function normalizeIndianState(raw: string): string | null {
  const key = normKey(raw);
  if (!key) return null;
  if (STATE_ALIASES[key]) return STATE_ALIASES[key]!;
  for (const name of INDIAN_STATES) {
    if (normKey(name) === key) return name;
  }
  return null;
}

export function isValidIndianPincode(raw: string): boolean {
  return /^[1-9][0-9]{5}$/.test(raw.trim());
}

/** Place names (city / region): real-looking text, not digits or keyboard mash. */
export function isPlausiblePlaceName(raw: string): boolean {
  const c = raw.trim();
  if (c.length < 2 || c.length > 80) return false;
  if (!/^[a-zA-Z\u00C0-\u024F][a-zA-Z\u00C0-\u024F\s.'-]{0,79}$/.test(c)) {
    return false;
  }
  // Must contain a vowel (Latin + common accents) — rejects "dcedcw", "1123".
  if (!/[aeiouyAEIOUY\u00C0-\u024F]/.test(c.replace(/[^a-zA-Z\u00C0-\u024F]/g, ""))) {
    return false;
  }
  const letters = c.replace(/[^a-zA-Z]/g, "").toLowerCase();
  if (letters.length >= 5) {
    const vowels = (letters.match(/[aeiouy]/g) || []).length;
    if (vowels < 2 || vowels / letters.length < 0.2) return false;
  } else if (letters.length >= 4) {
    const vowels = (letters.match(/[aeiouy]/g) || []).length;
    if (vowels / letters.length < 0.15) return false;
  }
  // Reject long runs of the same letter (aaaa, xxx).
  if (/(.)\1{3,}/i.test(letters)) return false;
  return true;
}

export function isValidCityName(raw: string): boolean {
  const c = raw.trim();
  if (c.length < 2 || c.length > 60) return false;
  return isPlausiblePlaceName(c);
}

export function isValidOverseasPostal(raw: string): boolean {
  const p = raw.trim();
  if (!p) return false;
  return /^[A-Za-z0-9][A-Za-z0-9\s-]{1,11}$/.test(p);
}

/**
 * Country-specific postal / ZIP validation.
 * Returns null when valid (or empty + optional), otherwise an error message.
 */
export function postalErrorForCountry(
  country: string,
  raw: string,
  opts?: { required?: boolean },
): string | null {
  const pin = raw.trim();
  const required = opts?.required === true;
  if (!pin) {
    return required ? "Postal / ZIP code is required for this country" : null;
  }

  if (isIndiaCountry(country)) {
    if (!isValidIndianPincode(pin)) {
      return "Enter a valid 6-digit Indian PIN (e.g. 395003)";
    }
    return null;
  }

  if (matchesCountry(country, "united states", "usa", "u.s.", "america")) {
    if (!/^\d{5}(-\d{4})?$/.test(pin)) {
      return "Enter a valid US ZIP code (e.g. 10001 or 10001-1234)";
    }
    return null;
  }

  if (matchesCountry(country, "canada")) {
    if (!/^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(pin)) {
      return "Enter a valid Canadian postal code (e.g. M5H 2N2)";
    }
    return null;
  }

  if (matchesCountry(country, "united kingdom", "uk", "britain")) {
    if (!/^[A-Za-z]{1,2}\d[A-Za-z\d]?\s?\d[A-Za-z]{2}$/.test(pin)) {
      return "Enter a valid UK postcode (e.g. SW1A 1AA)";
    }
    return null;
  }

  if (matchesCountry(country, "morocco")) {
    if (!/^\d{5}$/.test(pin)) {
      return "Enter a valid Moroccan postal code (5 digits, e.g. 20000)";
    }
    return null;
  }

  if (matchesCountry(country, "kenya")) {
    if (!/^\d{5}$/.test(pin)) {
      return "Enter a valid Kenyan postal code (5 digits, e.g. 00100)";
    }
    return null;
  }

  if (matchesCountry(country, "south africa")) {
    if (!/^\d{4}$/.test(pin)) {
      return "Enter a valid South African postal code (4 digits, e.g. 2000)";
    }
    return null;
  }

  if (matchesCountry(country, "nigeria")) {
    if (!/^\d{6}$/.test(pin)) {
      return "Enter a valid Nigerian postal code (6 digits)";
    }
    return null;
  }

  if (matchesCountry(country, "germany")) {
    if (!/^\d{5}$/.test(pin)) {
      return "Enter a valid German PLZ (5 digits)";
    }
    return null;
  }

  if (matchesCountry(country, "france")) {
    if (!/^\d{5}$/.test(pin)) {
      return "Enter a valid French code postal (5 digits)";
    }
    return null;
  }

  if (matchesCountry(country, "australia")) {
    if (!/^\d{4}$/.test(pin)) {
      return "Enter a valid Australian postcode (4 digits)";
    }
    return null;
  }

  if (matchesCountry(country, "china", "singapore")) {
    if (!/^\d{6}$/.test(pin)) {
      return "Enter a valid 6-digit postal code";
    }
    return null;
  }

  if (matchesCountry(country, "united arab emirates", "uae", "saudi arabia", "ksa", "qatar", "oman", "kuwait", "bahrain")) {
    if (!/^\d{4,6}$/.test(pin.replace(/\s/g, ""))) {
      return "Enter a valid postal / P.O. Box code (4–6 digits)";
    }
    return null;
  }

  // Generic overseas — reject Indian-style PIN when country is not India,
  // and require a plausible alphanumeric postal format.
  if (/^[1-9]\d{5}$/.test(pin) && !matchesCountry(country, "bangladesh", "sri lanka")) {
    return `This looks like an Indian PIN code — it does not match ${country.trim() || "the selected country"}`;
  }
  if (!isValidOverseasPostal(pin)) {
    return "Enter a valid postal / ZIP code (3–12 letters or digits)";
  }
  return null;
}

function regionErrorForCountry(country: string, raw: string): string | null {
  const state = raw.trim();
  if (!state) {
    return isIndiaCountry(country)
      ? "State is required"
      : "State / province / region is required";
  }

  if (isIndiaCountry(country)) {
    if (!normalizeIndianState(state)) {
      return "Select a valid Indian state or union territory";
    }
    return null;
  }

  if (!isPlausiblePlaceName(state)) {
    return "Enter a real region / province name (not numbers or random letters)";
  }

  if (matchesCountry(country, "united states", "usa", "u.s.", "america")) {
    if (!inNamedList(state, US_STATES)) {
      return "Enter a valid US state (e.g. California, Texas, New York)";
    }
    return null;
  }

  if (matchesCountry(country, "canada")) {
    if (!inNamedList(state, CANADA_PROVINCES)) {
      return "Enter a valid Canadian province or territory (e.g. Ontario, BC)";
    }
    return null;
  }

  if (matchesCountry(country, "united arab emirates", "uae", "dubai", "abu dhabi")) {
    if (!inNamedList(state, UAE_EMIRATES)) {
      return "Enter a valid UAE emirate (e.g. Dubai, Abu Dhabi, Sharjah)";
    }
    return null;
  }

  if (matchesCountry(country, "morocco")) {
    if (!inNamedList(state, MOROCCO_REGIONS)) {
      return "Enter a valid Moroccan region or city (e.g. Casablanca-Settat, Rabat)";
    }
    return null;
  }

  if (state.length < 2 || state.length > 80) {
    return "Enter a valid state / province (2–80 characters)";
  }
  return null;
}

function addressCountryMismatchError(
  country: string,
  address: string,
): string | null {
  if (isIndiaCountry(country) || !address.trim()) return null;
  const a = address.toLowerCase();
  const indiaMarkers =
    /\bgidc\b|\bpandesara\b|\bgujarat\b|\bsurat\b|\bmaharashtra\b|\bmumbai\b|\bdelhi\b|\bpincode\b|\bpin\s*code\b|\b\d{6}\b/;
  if (indiaMarkers.test(a)) {
    return `This address looks like an India location — set Country to India, or enter an address in ${country.trim()}`;
  }
  return null;
}

export function validateCompanyProfile(input: CompanyProfileInput): FieldErrors {
  const india = isIndiaCountry(input.country);
  const errors: FieldErrors = {};

  const company = input.companyName.trim();
  if (!company) {
    errors.companyName = "Trade / display name is required";
  } else if (company.length < 2) {
    errors.companyName = "Name is too short (min 2 characters)";
  } else if (company.length > 120) {
    errors.companyName = "Name is too long (max 120 characters)";
  } else if (!hasLetter(company)) {
    errors.companyName = "Name must include letters";
  }

  const legal = input.legalName.trim();
  if (!legal) {
    errors.legalName = "Legal entity name is required";
  } else if (legal.length < 3) {
    errors.legalName = "Legal name is too short (min 3 characters)";
  } else if (legal.length > 200) {
    errors.legalName = "Legal name is too long (max 200 characters)";
  } else if (!hasLetter(legal)) {
    errors.legalName = "Legal name must include letters";
  }

  const address = input.businessAddress.trim();
  if (!address) {
    errors.businessAddress = "Registered business address is required";
  } else if (address.length < 10) {
    errors.businessAddress =
      "Enter a fuller address (street / plot / area — min 10 characters)";
  } else if (address.length > 500) {
    errors.businessAddress = "Address is too long (max 500 characters)";
  } else {
    const mismatch = addressCountryMismatchError(input.country, address);
    if (mismatch) errors.businessAddress = mismatch;
  }

  const city =
    input.city.trim() ||
    (input.location ?? "").trim().split(",")[0]?.trim() ||
    "";
  if (!city) {
    errors.city = "City is required";
  } else if (!isValidCityName(city)) {
    errors.city =
      "Enter a real city name for this country (letters only — not random text)";
  }

  const regionErr = regionErrorForCountry(input.country, input.state);
  if (regionErr) errors.state = regionErr;

  const postalRequired =
    india ||
    matchesCountry(
      input.country,
      "united states",
      "usa",
      "canada",
      "united kingdom",
      "uk",
      "south africa",
      "germany",
      "france",
      "australia",
      "china",
      "singapore",
    );
  const pinErr = postalErrorForCountry(input.country, input.pincode, {
    required: postalRequired,
  });
  if (pinErr) errors.pincode = pinErr;

  if (!input.country.trim()) {
    errors.country = "Country is required";
  }

  const years = (input.yearsInBusiness ?? "").trim();
  if (years) {
    const n = Number(years);
    if (!Number.isFinite(n) || n < 0 || n > 200 || !/^\d{1,3}$/.test(years)) {
      errors.yearsInBusiness = "Years in business must be 0–200";
    }
  }

  return errors;
}

export function firstCompanyProfileError(input: CompanyProfileInput): string | null {
  const errors = validateCompanyProfile(input);
  const order: (keyof FieldErrors)[] = [
    "companyName",
    "legalName",
    "businessAddress",
    "city",
    "state",
    "pincode",
    "country",
    "yearsInBusiness",
  ];
  for (const k of order) {
    if (errors[k]) return errors[k]!;
  }
  return null;
}

export function canonicalState(state: string, country: string): string {
  if (!isIndiaCountry(country)) return state.trim();
  return normalizeIndianState(state) ?? state.trim();
}
