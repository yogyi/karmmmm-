/**
 * Company profile field validation (step 1).
 * India rules mirror real KYC expectations; GST government lookup comes later.
 */

import { isIndiaCountry } from "./country";
import { getCompanyProfileLabels } from "./companyProfileLabels";

/** Official / common India state & UT names (matched case-insensitively). */
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

const STATE_ALIASES: Record<string, string> = {
  orissa: "Odisha",
  uttaranchal: "Uttarakhand",
  pondicherry: "Puducherry",
  "nct of delhi": "Delhi",
  "new delhi": "Delhi",
  "jammu & kashmir": "Jammu & Kashmir",
  "jammu and kashmir": "Jammu & Kashmir",
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
    .replace(/\s+/g, " ")
    .replace(/&/g, "and");
}

/** Resolve a typed India state to the canonical display name, or null. */
export function normalizeIndianState(raw: string): string | null {
  const key = normKey(raw);
  if (!key) return null;
  if (STATE_ALIASES[key]) return STATE_ALIASES[key]!;
  for (const name of INDIAN_STATES) {
    if (normKey(name) === key) return name;
  }
  return null;
}

/** India PIN: 6 digits, first digit 1–9 (never starts with 0). */
export function isValidIndianPincode(raw: string): boolean {
  return /^[1-9][0-9]{5}$/.test(raw.trim());
}

/** Overseas postal / ZIP: 3–12 chars, letters/digits/space/hyphen. */
export function isValidOverseasPostal(raw: string): boolean {
  const p = raw.trim();
  if (!p) return false;
  return /^[A-Za-z0-9][A-Za-z0-9\s-]{1,11}$/.test(p);
}

export function isValidCityName(raw: string): boolean {
  const c = raw.trim();
  if (c.length < 2 || c.length > 60) return false;
  return /^[a-zA-Z\u00C0-\u024F][a-zA-Z\u00C0-\u024F\s.'-]{0,59}$/.test(c);
}

/**
 * Validate company profile fields. Returns per-field errors (empty = valid).
 * When India: PIN required; state must be a real Indian state/UT.
 */
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
    errors.businessAddress = "Enter a fuller address (street / plot / area — min 10 characters)";
  } else if (address.length > 500) {
    errors.businessAddress = "Address is too long (max 500 characters)";
  }

  const city = input.city.trim() || (input.location ?? "").trim().split(",")[0]?.trim() || "";
  if (!city) {
    errors.city = "City is required";
  } else if (!isValidCityName(city)) {
    errors.city = "Enter a valid city name (letters only, 2–60 characters)";
  }

  const state = input.state.trim();
  const profileLabels = getCompanyProfileLabels(input.country);
  if (!state) {
    errors.state = `${profileLabels.stateLabel.replace(" *", "")} is required`;
  } else if (india) {
    if (!normalizeIndianState(state)) {
      errors.state = "Select a valid Indian state or union territory";
    }
  } else if (state.length < 2 || state.length > 80) {
    errors.state = "Enter a valid state / province (2–80 characters)";
  }

  const pin = input.pincode.trim();
  if (india) {
    if (!pin) {
      errors.pincode = "PIN code is required";
    } else if (!isValidIndianPincode(pin)) {
      errors.pincode = "Enter a valid 6-digit Indian PIN (e.g. 395003)";
    }
  } else if (profileLabels.postalRequired && !pin) {
    errors.pincode = `${profileLabels.postalLabel.replace(" *", "")} is required`;
  } else if (pin && !isValidOverseasPostal(pin)) {
    errors.pincode = `Enter a valid ${profileLabels.postalLabel.replace(" *", "").toLowerCase()} (3–12 characters)`;
  }

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

/** Canonical state string to persist (India only). */
export function canonicalState(state: string, country: string): string {
  if (!isIndiaCountry(country)) return state.trim();
  return normalizeIndianState(state) ?? state.trim();
}
