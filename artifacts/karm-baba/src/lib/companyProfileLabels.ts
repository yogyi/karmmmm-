import { isIndiaCountry } from "@/lib/country";

export interface CompanyProfileLabels {
  legalNamePlaceholder: string;
  stateLabel: string;
  statePlaceholder: string;
  stateRequired: boolean;
  postalLabel: string;
  postalPlaceholder: string;
  postalRequired: boolean;
  cityPlaceholder: string;
  addressPlaceholder: string;
  /** Shown under country when extra guidance helps (e.g. US state-level registration). */
  countryHint?: string;
}

function norm(country: string): string {
  return country.trim().toLowerCase();
}

function matches(country: string, ...names: string[]): boolean {
  const c = norm(country);
  return names.some((n) => c === n.toLowerCase() || c.includes(n.toLowerCase()));
}

const DEFAULT_OVERSEAS: CompanyProfileLabels = {
  legalNamePlaceholder: "As on company registration certificate",
  stateLabel: "State / province / region *",
  statePlaceholder: "Province or region",
  stateRequired: true,
  postalLabel: "Postal / ZIP code",
  postalPlaceholder: "Postal code",
  postalRequired: false,
  cityPlaceholder: "City",
  addressPlaceholder: "Street / building / area",
};

const INDIA: CompanyProfileLabels = {
  legalNamePlaceholder: "As on GST certificate",
  stateLabel: "State *",
  statePlaceholder: "Select state / UT",
  stateRequired: true,
  postalLabel: "PIN code *",
  postalPlaceholder: "395003",
  postalRequired: true,
  cityPlaceholder: "Surat",
  addressPlaceholder: "Street / building / area",
};

/** Address field labels that match local registration terminology. */
export function getCompanyProfileLabels(country: string): CompanyProfileLabels {
  if (isIndiaCountry(country)) return INDIA;

  if (matches(country, "united arab emirates", "uae", "dubai", "abu dhabi")) {
    return {
      ...DEFAULT_OVERSEAS,
      legalNamePlaceholder: "As on trade licence",
      stateLabel: "Emirate *",
      statePlaceholder: "Dubai, Abu Dhabi, Sharjah…",
      postalLabel: "P.O. Box / postal code",
      postalPlaceholder: "00000",
      cityPlaceholder: "Dubai",
      addressPlaceholder: "Building / street / free zone",
    };
  }

  if (matches(country, "saudi arabia", "ksa", "saudi")) {
    return {
      ...DEFAULT_OVERSEAS,
      legalNamePlaceholder: "As on Commercial Registration (CR)",
      stateLabel: "Region / province *",
      statePlaceholder: "Riyadh, Makkah, Eastern Province…",
      postalLabel: "Postal code",
      postalPlaceholder: "11564",
      cityPlaceholder: "Riyadh",
    };
  }

  if (matches(country, "qatar", "oman", "kuwait", "bahrain")) {
    return {
      ...DEFAULT_OVERSEAS,
      legalNamePlaceholder: "As on commercial registration",
      stateLabel: "Governorate / emirate *",
      statePlaceholder: "Governorate or region",
      cityPlaceholder: matches(country, "qatar") ? "Doha" : "Capital city",
    };
  }

  if (matches(country, "kenya")) {
    return {
      ...DEFAULT_OVERSEAS,
      legalNamePlaceholder: "As on Certificate of Incorporation",
      stateLabel: "County *",
      statePlaceholder: "Nairobi, Mombasa, Kiambu…",
      postalLabel: "Postal code",
      postalPlaceholder: "00100",
      cityPlaceholder: "Nairobi",
      addressPlaceholder: "Street / building / estate",
    };
  }

  if (matches(country, "nigeria")) {
    return {
      ...DEFAULT_OVERSEAS,
      legalNamePlaceholder: "As on CAC certificate",
      stateLabel: "State *",
      statePlaceholder: "Lagos, Kano, Rivers…",
      postalLabel: "Postal code",
      postalPlaceholder: "100001",
      cityPlaceholder: "Lagos",
    };
  }

  if (matches(country, "south africa")) {
    return {
      ...DEFAULT_OVERSEAS,
      legalNamePlaceholder: "As on CIPC registration",
      stateLabel: "Province *",
      statePlaceholder: "Gauteng, Western Cape, KwaZulu-Natal…",
      postalLabel: "Postal code *",
      postalPlaceholder: "2000",
      postalRequired: true,
      cityPlaceholder: "Johannesburg",
    };
  }

  if (matches(country, "egypt")) {
    return {
      ...DEFAULT_OVERSEAS,
      legalNamePlaceholder: "As on commercial register extract",
      stateLabel: "Governorate *",
      statePlaceholder: "Cairo, Giza, Alexandria…",
      postalLabel: "Postal code",
      postalPlaceholder: "11511",
      cityPlaceholder: "Cairo",
    };
  }

  if (matches(country, "ethiopia")) {
    return {
      ...DEFAULT_OVERSEAS,
      legalNamePlaceholder: "As on business licence",
      stateLabel: "Region *",
      statePlaceholder: "Addis Ababa, Oromia…",
      cityPlaceholder: "Addis Ababa",
    };
  }

  if (matches(country, "tanzania", "uganda")) {
    return {
      ...DEFAULT_OVERSEAS,
      legalNamePlaceholder: "As on BRELA / URSB certificate",
      stateLabel: "Region *",
      statePlaceholder: matches(country, "tanzania") ? "Dar es Salaam…" : "Central Region…",
      cityPlaceholder: matches(country, "tanzania") ? "Dar es Salaam" : "Kampala",
    };
  }

  if (matches(country, "ghana")) {
    return {
      ...DEFAULT_OVERSEAS,
      legalNamePlaceholder: "As on Registrar General certificate",
      stateLabel: "Region *",
      statePlaceholder: "Greater Accra, Ashanti…",
      cityPlaceholder: "Accra",
    };
  }

  if (matches(country, "morocco")) {
    return {
      ...DEFAULT_OVERSEAS,
      legalNamePlaceholder: "As on RC extract (Registre de Commerce)",
      stateLabel: "Region *",
      statePlaceholder: "Casablanca-Settat, Rabat-Salé…",
      cityPlaceholder: "Casablanca",
    };
  }

  if (matches(country, "united states", "usa", "u.s.", "america")) {
    return {
      ...DEFAULT_OVERSEAS,
      legalNamePlaceholder: "As on state Articles of Incorporation",
      stateLabel: "State *",
      statePlaceholder: "Delaware, Texas, California…",
      postalLabel: "ZIP code *",
      postalPlaceholder: "10001",
      postalRequired: true,
      cityPlaceholder: "New York",
      countryHint:
        "US companies register by state — pick the state where you incorporated, then use matching documents on later steps.",
    };
  }

  if (matches(country, "canada")) {
    return {
      ...DEFAULT_OVERSEAS,
      legalNamePlaceholder: "As on federal or provincial incorporation",
      stateLabel: "Province / territory *",
      statePlaceholder: "Ontario, British Columbia, Quebec…",
      postalLabel: "Postal code *",
      postalPlaceholder: "M5H 2N2",
      postalRequired: true,
      cityPlaceholder: "Toronto",
    };
  }

  if (matches(country, "united kingdom", "uk", "britain")) {
    return {
      ...DEFAULT_OVERSEAS,
      legalNamePlaceholder: "As on Companies House certificate",
      stateLabel: "County / region *",
      statePlaceholder: "England, Scotland, Wales…",
      postalLabel: "Postcode *",
      postalPlaceholder: "SW1A 1AA",
      postalRequired: true,
      cityPlaceholder: "London",
    };
  }

  if (matches(country, "turkey", "türkiye")) {
    return {
      ...DEFAULT_OVERSEAS,
      legalNamePlaceholder: "As on trade registry gazette",
      stateLabel: "Province *",
      statePlaceholder: "Istanbul, Ankara, Izmir…",
      cityPlaceholder: "Istanbul",
    };
  }

  if (matches(country, "iraq")) {
    return {
      ...DEFAULT_OVERSEAS,
      legalNamePlaceholder: "As on Ministry of Trade registration",
      stateLabel: "Governorate *",
      statePlaceholder: "Baghdad, Basra…",
      cityPlaceholder: "Baghdad",
    };
  }

  if (matches(country, "singapore")) {
    return {
      ...DEFAULT_OVERSEAS,
      legalNamePlaceholder: "As on ACRA business profile",
      stateLabel: "Region (optional)",
      statePlaceholder: "Island city-state — leave blank if N/A",
      stateRequired: false,
      postalLabel: "Postal code *",
      postalPlaceholder: "018956",
      postalRequired: true,
      cityPlaceholder: "Singapore",
    };
  }

  if (matches(country, "germany", "france", "australia")) {
    const city =
      matches(country, "germany") ? "Berlin" : matches(country, "france") ? "Paris" : "Sydney";
    return {
      ...DEFAULT_OVERSEAS,
      legalNamePlaceholder: "As on commercial register extract",
      stateLabel: matches(country, "germany")
        ? "Bundesland *"
        : matches(country, "france")
          ? "Region *"
          : "State / territory *",
      statePlaceholder: matches(country, "germany")
        ? "Bayern, NRW…"
        : matches(country, "france")
          ? "Île-de-France…"
          : "NSW, Victoria…",
      postalLabel: matches(country, "germany")
        ? "PLZ *"
        : matches(country, "france")
          ? "Code postal *"
          : "Postcode *",
      postalRequired: true,
      cityPlaceholder: city,
    };
  }

  if (matches(country, "bangladesh", "sri lanka", "nepal")) {
    return {
      ...DEFAULT_OVERSEAS,
      legalNamePlaceholder: "As on company registration",
      stateLabel: matches(country, "bangladesh")
        ? "Division *"
        : matches(country, "sri lanka")
          ? "Province *"
          : "Province *",
      statePlaceholder: "Province or division",
      postalLabel: "Postal code",
      cityPlaceholder: matches(country, "bangladesh")
        ? "Dhaka"
        : matches(country, "sri lanka")
          ? "Colombo"
          : "Kathmandu",
    };
  }

  if (matches(country, "china")) {
    return {
      ...DEFAULT_OVERSEAS,
      legalNamePlaceholder: "As on business licence (营业执照)",
      stateLabel: "Province *",
      statePlaceholder: "Guangdong, Zhejiang…",
      postalLabel: "Postal code *",
      postalPlaceholder: "510000",
      postalRequired: true,
      cityPlaceholder: "Guangzhou",
    };
  }

  return DEFAULT_OVERSEAS;
}
