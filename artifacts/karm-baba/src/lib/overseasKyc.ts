/** Region-specific KYC labels for non-India sellers (no GST). */
export interface OverseasKycLabels {
  businessRegistrationLabel: string;
  businessRegistrationPlaceholder: string;
  businessRegistrationHint: string;
  taxIdLabel: string;
  taxIdPlaceholder: string;
  taxIdHint: string;
  /** USA: registration is state-level — prompt for state on company step. */
  usStateNote?: string;
}

function normCountry(country: string): string {
  return country.trim().toLowerCase();
}

function matches(country: string, ...names: string[]): boolean {
  const c = normCountry(country);
  return names.some((n) => c === n.toLowerCase() || c.includes(n.toLowerCase()));
}

const DEFAULT_LABELS: OverseasKycLabels = {
  businessRegistrationLabel: "Business registration certificate *",
  businessRegistrationPlaceholder: "Registration / licence number",
  businessRegistrationHint:
    "Upload your local company registration certificate (PDF or clear photo).",
  taxIdLabel: "Local tax number *",
  taxIdPlaceholder: "Tax / VAT / TIN number",
  taxIdHint: "Your official tax identifier issued by local authorities.",
};

/** Labels from regional KYC tables (UAE, KSA, Africa, Americas, etc.). */
export function getOverseasKycLabels(country: string): OverseasKycLabels {
  const c = country.trim();
  if (!c) return DEFAULT_LABELS;

  if (matches(c, "united arab emirates", "uae", "dubai", "abu dhabi")) {
    return {
      businessRegistrationLabel: "Trade licence + Establishment Card *",
      businessRegistrationPlaceholder: "Trade licence / DED number",
      businessRegistrationHint:
        "DED or free-zone trade licence plus Establishment Card (PDF or photo).",
      taxIdLabel: "TRN (VAT) *",
      taxIdPlaceholder: "15-digit TRN",
      taxIdHint: "UAE Tax Registration Number from the Federal Tax Authority.",
    };
  }

  if (matches(c, "saudi arabia", "ksa", "saudi")) {
    return {
      businessRegistrationLabel: "Commercial Registration (CR) *",
      businessRegistrationPlaceholder: "CR number",
      businessRegistrationHint: "Upload your Ministry of Commerce CR certificate.",
      taxIdLabel: "VAT certificate (ZATCA) *",
      taxIdPlaceholder: "VAT registration number",
      taxIdHint: "ZATCA VAT certificate number.",
    };
  }

  if (matches(c, "qatar", "oman", "kuwait", "bahrain")) {
    return {
      businessRegistrationLabel: "Commercial registration + licence *",
      businessRegistrationPlaceholder: "CR / licence number",
      businessRegistrationHint: "Commercial Registration and Commercial Licence together.",
      taxIdLabel: "TIN / VAT *",
      taxIdPlaceholder: "TIN or VAT number",
      taxIdHint: "Tax Identification or VAT number for your emirate/kingdom.",
    };
  }

  if (matches(c, "iraq")) {
    return {
      businessRegistrationLabel: "Ministry of Trade registration *",
      businessRegistrationPlaceholder: "Registration number",
      businessRegistrationHint: "Company registration from the Ministry of Trade.",
      taxIdLabel: "Tax ID *",
      taxIdPlaceholder: "Tax identification number",
      taxIdHint: "National tax ID for your business.",
    };
  }

  if (matches(c, "kenya")) {
    return {
      businessRegistrationLabel: "Certificate of Incorporation + CR12 *",
      businessRegistrationPlaceholder: "Company registration number",
      businessRegistrationHint: "Certificate of Incorporation and CR12 from Companies Registry.",
      taxIdLabel: "KRA PIN *",
      taxIdPlaceholder: "KRA PIN",
      taxIdHint: "Kenya Revenue Authority Personal Identification Number.",
    };
  }

  if (matches(c, "nigeria")) {
    return {
      businessRegistrationLabel: "CAC certificate (RC number) *",
      businessRegistrationPlaceholder: "RC number",
      businessRegistrationHint: "Corporate Affairs Commission certificate with RC number.",
      taxIdLabel: "FIRS TIN *",
      taxIdPlaceholder: "FIRS TIN",
      taxIdHint: "Federal Inland Revenue Service Tax Identification Number.",
    };
  }

  if (matches(c, "ethiopia")) {
    return {
      businessRegistrationLabel: "Business licence (Ministry of Trade) *",
      businessRegistrationPlaceholder: "Licence number",
      businessRegistrationHint: "Business licence issued by the Ministry of Trade.",
      taxIdLabel: "TIN *",
      taxIdPlaceholder: "Tax identification number",
      taxIdHint: "Ethiopian Tax Identification Number.",
    };
  }

  if (matches(c, "tanzania", "uganda")) {
    return {
      businessRegistrationLabel: "BRELA / URSB certificate *",
      businessRegistrationPlaceholder: "Registration number",
      businessRegistrationHint:
        "Business Registration and Licensing Agency (TZ) or URSB (UG) certificate.",
      taxIdLabel: "TIN *",
      taxIdPlaceholder: "TIN",
      taxIdHint: "Tax Identification Number.",
    };
  }

  if (matches(c, "south africa")) {
    return {
      businessRegistrationLabel: "CIPC registration *",
      businessRegistrationPlaceholder: "CIPC registration number",
      businessRegistrationHint: "Companies and Intellectual Property Commission registration.",
      taxIdLabel: "VAT number *",
      taxIdPlaceholder: "VAT number",
      taxIdHint: "SARS VAT registration number.",
    };
  }

  if (matches(c, "egypt")) {
    return {
      businessRegistrationLabel: "Commercial register *",
      businessRegistrationPlaceholder: "Commercial register number",
      businessRegistrationHint: "Extract from the Egyptian Commercial Register.",
      taxIdLabel: "Tax card *",
      taxIdPlaceholder: "Tax card number",
      taxIdHint: "Egyptian Tax Card number.",
    };
  }

  if (matches(c, "united states", "usa", "u.s.", "america")) {
    return {
      businessRegistrationLabel: "Articles of incorporation *",
      businessRegistrationPlaceholder: "State filing / entity number",
      businessRegistrationHint:
        "State-level Articles of Incorporation or Organization (no national registry).",
      taxIdLabel: "EIN *",
      taxIdPlaceholder: "XX-XXXXXXX",
      taxIdHint: "Employer Identification Number (EIN). W-9 may be requested later.",
      usStateNote:
        "US companies register by state — enter your state on the company step, then upload that state's filing.",
    };
  }

  if (matches(c, "canada")) {
    return {
      businessRegistrationLabel: "Articles of incorporation *",
      businessRegistrationPlaceholder: "Corporation number",
      businessRegistrationHint: "Federal or provincial Articles of Incorporation.",
      taxIdLabel: "Business Number (BN) + GST/HST *",
      taxIdPlaceholder: "BN / GST number",
      taxIdHint: "CRA Business Number and GST/HST registration.",
    };
  }

  if (matches(c, "turkey", "türkiye")) {
    return {
      businessRegistrationLabel: "Trade registry gazette *",
      businessRegistrationPlaceholder: "Trade registry number",
      businessRegistrationHint: "Ticaret Sicil Gazetesi registration extract.",
      taxIdLabel: "Vergi No *",
      taxIdPlaceholder: "Vergi kimlik numarası",
      taxIdHint: "Turkish tax identification number.",
    };
  }

  if (matches(c, "united kingdom", "uk", "britain")) {
    return {
      businessRegistrationLabel: "Companies House certificate *",
      businessRegistrationPlaceholder: "Company number",
      businessRegistrationHint: "Certificate of incorporation from Companies House.",
      taxIdLabel: "VAT / UTR *",
      taxIdPlaceholder: "VAT or UTR number",
      taxIdHint: "HMRC VAT number or Unique Taxpayer Reference.",
    };
  }

  return DEFAULT_LABELS;
}

export function isValidOverseasTaxId(taxId: string): boolean {
  const t = taxId.trim();
  return t.length >= 2 && t.length <= 32;
}
