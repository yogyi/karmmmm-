import { isValidContactPhone } from "./country";
import { validateGstin } from "./gstin";

export type IndiaBuyerProfileInput = {
  name: string;
  company: string;
  phone?: string;
  gstin?: string;
};

export type IndiaBuyerProfileErrors = {
  name?: string;
  company?: string;
  phone?: string;
  gstin?: string;
};

export type IndiaBuyerProfileNormalized = {
  name: string;
  company: string;
  phone: string | null;
  phoneE164: string | null;
  gstin: string | null;
};

function cleanName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export function normalizeIndiaMobile(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length === 12) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  return digits;
}

/** Keep in sync with karm-baba/src/lib/indiaBuyerProfile.ts */
export function validateIndiaBuyerProfile(
  input: IndiaBuyerProfileInput,
): { ok: true; value: IndiaBuyerProfileNormalized } | { ok: false; errors: IndiaBuyerProfileErrors } {
  const errors: IndiaBuyerProfileErrors = {};
  const name = cleanName(input.name ?? "");
  const company = cleanName(input.company ?? "");
  const phoneRaw = (input.phone ?? "").trim();
  const gstinRaw = (input.gstin ?? "").trim();

  if (name.length < 2) {
    errors.name = "Enter your full name";
  } else if (name.length > 120) {
    errors.name = "Name is too long";
  }

  if (company.length < 2) {
    errors.company = "Enter your company or business name";
  } else if (company.length > 160) {
    errors.company = "Company name is too long";
  }

  let phone: string | null = null;
  let phoneE164: string | null = null;
  if (phoneRaw) {
    const normalized = normalizeIndiaMobile(phoneRaw);
    if (!isValidContactPhone(normalized, "India")) {
      errors.phone = "Enter a valid 10-digit Indian mobile number";
    } else {
      phone = normalized;
      phoneE164 = `+91${normalized}`;
    }
  }

  let gstin: string | null = null;
  if (gstinRaw) {
    const gst = validateGstin(gstinRaw);
    if (!gst.ok) {
      errors.gstin = gst.error;
    } else {
      gstin = gst.gstin;
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: { name, company, phone, phoneE164, gstin },
  };
}
