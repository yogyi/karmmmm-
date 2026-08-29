/**
 * Overseas KYC: company-domain email instead of GST/PAN.
 * Keep in sync with api-server/src/lib/businessEmail.ts
 */

import { isAllowedBuyerCountry, isIndiaCountry } from "@/lib/country";

const FREE_EMAIL_DOMAINS = new Set(
  [
    "gmail.com",
    "googlemail.com",
    "yahoo.com",
    "yahoo.co.in",
    "yahoo.co.uk",
    "ymail.com",
    "rocketmail.com",
    "hotmail.com",
    "hotmail.co.uk",
    "outlook.com",
    "outlook.in",
    "live.com",
    "msn.com",
    "aol.com",
    "icloud.com",
    "me.com",
    "mac.com",
    "mail.com",
    "email.com",
    "protonmail.com",
    "proton.me",
    "pm.me",
    "zoho.com",
    "zohomail.com",
    "gmx.com",
    "gmx.net",
    "yandex.com",
    "yandex.ru",
    "mail.ru",
    "inbox.com",
    "fastmail.com",
    "tutanota.com",
    "tuta.com",
    "rediffmail.com",
    "qq.com",
    "163.com",
    "126.com",
    "naver.com",
    "daum.net",
    "hey.com",
    "hushmail.com",
    "gmx.us",
    "mailinator.com",
    "guerrillamail.com",
    "tempmail.com",
    "10minutemail.com",
    "yopmail.com",
  ].map((d) => d.toLowerCase()),
);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailDomain(email: string): string | null {
  const at = email.trim().toLowerCase().lastIndexOf("@");
  if (at < 0) return null;
  const domain = email.trim().toLowerCase().slice(at + 1);
  return domain || null;
}

export function isFreeEmailDomain(domain: string | null | undefined): boolean {
  if (!domain) return true;
  const d = domain.toLowerCase().replace(/^\.+/, "");
  if (FREE_EMAIL_DOMAINS.has(d)) return true;
  for (const free of FREE_EMAIL_DOMAINS) {
    if (d === free || d.endsWith(`.${free}`)) return true;
  }
  return false;
}

export function websiteHost(website: string | null | undefined): string | null {
  if (!website?.trim()) return null;
  try {
    const raw = website.trim().includes("://") ? website.trim() : `https://${website.trim()}`;
    const host = new URL(raw).hostname.toLowerCase().replace(/^www\./, "");
    return host || null;
  } catch {
    return null;
  }
}

/** Optional website field — reject garbage like "www.com" when user enters something. */
export function validateOptionalWebsite(
  website: string | null | undefined,
): { ok: true; host?: string } | { ok: false; error: string } {
  const raw = website?.trim();
  if (!raw) return { ok: true };
  const host = websiteHost(raw);
  if (!host || !host.includes(".")) {
    return {
      ok: false,
      error: "Enter a valid company website (e.g. https://yourcompany.com) or leave blank",
    };
  }
  const parts = host.split(".").filter(Boolean);
  if (parts.length < 2 || parts.some((p) => p.length < 2)) {
    return {
      ok: false,
      error: "Enter a valid company website (e.g. https://yourcompany.com) or leave blank",
    };
  }
  if (isBlockedWebsiteHost(host)) {
    return {
      ok: false,
      error: "Enter your real company website — not a placeholder or test domain",
    };
  }
  return { ok: true, host };
}

const BLOCKED_WEBSITE_HOSTS = new Set(
  [
    "example.com",
    "example.org",
    "example.net",
    "test.com",
    "testing.com",
    "localhost",
    "invalid.com",
    "domain.com",
    "website.com",
    "yoursite.com",
    "yourcompany.com",
    "company.com",
    "abc.com",
    "xyz.com",
    "asdf.com",
    "qwerty.com",
    "temp.com",
    "fake.com",
  ].map((h) => h.toLowerCase()),
);

function isBlockedWebsiteHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^www\./, "");
  if (BLOCKED_WEBSITE_HOSTS.has(h)) return true;
  if (h.endsWith(".local") || h.endsWith(".test") || h.endsWith(".invalid")) return true;
  return false;
}

const BLOCKED_REGISTRATION = new Set(
  [
    "test",
    "testing",
    "dummy",
    "sample",
    "none",
    "null",
    "n/a",
    "na",
    "nil",
    "xxx",
    "xxxx",
    "abc",
    "abcd",
    "abcde",
    "abcdef",
    "asdf",
    "asdfgh",
    "qwer",
    "qwerty",
    "zxcv",
    "zxcvbn",
    "gafbae",
    "garbage",
    "fake",
    "1234",
    "12345",
    "123456",
    "1234567",
    "12345678",
    "0000",
    "00000",
    "1111",
    "11111",
  ].map((s) => s.toLowerCase()),
);

/**
 * Trade licence / CR / incorporation number — reject keyboard mash and placeholders.
 * Real IDs almost always include at least one digit.
 */
export function validateRegistrationNumber(
  raw: string | null | undefined,
): { ok: true; value: string } | { ok: false; error: string } {
  const value = (raw ?? "").trim();
  if (!value) {
    return {
      ok: false,
      error: "Enter your company registration / trade licence number",
    };
  }
  if (value.length < 4 || value.length > 40) {
    return {
      ok: false,
      error: "Registration number must be 4–40 characters",
    };
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9\s./-]{2,39}$/.test(value)) {
    return {
      ok: false,
      error: "Use letters, numbers, spaces, or - / . only (e.g. CR-1234567)",
    };
  }

  const compact = value.replace(/[\s./-]/g, "").toLowerCase();
  if (compact.length < 4) {
    return { ok: false, error: "Enter a complete registration / trade licence number" };
  }
  if (BLOCKED_REGISTRATION.has(compact) || BLOCKED_REGISTRATION.has(value.toLowerCase())) {
    return {
      ok: false,
      error: "Enter a real registration / trade licence number — not a placeholder",
    };
  }
  if (/^(.)\1+$/i.test(compact)) {
    return { ok: false, error: "Enter a real registration / trade licence number" };
  }
  if (/^(0123|1234|2345|3456|4567|5678|6789|7890|9876|8765|7654)+$/.test(compact)) {
    return { ok: false, error: "Enter a real registration / trade licence number" };
  }
  if (/(.)\1{3,}/i.test(compact)) {
    return { ok: false, error: "Enter a real registration / trade licence number" };
  }
  // Almost all CR / trade licence / incorporation IDs include digits.
  if (!/\d/.test(compact)) {
    return {
      ok: false,
      error:
        "Enter a valid registration number (usually includes digits, e.g. CR-1234567 or 12345678)",
    };
  }
  // Reject digit-only runs that are too short / sequential
  if (/^\d+$/.test(compact) && compact.length < 5) {
    return {
      ok: false,
      error: "Enter a complete registration number (at least 5 digits if numeric)",
    };
  }
  return { ok: true, value };
}

export type BuyerCompanyProfileErrors = {
  country?: string;
  registrationNumber?: string;
  website?: string;
};

/** Overseas buyer step 2 — country, registration, website must look real. */
export function validateBuyerCompanyProfile(input: {
  country: string;
  registrationNumber: string;
  website: string;
  email?: string | null;
}): BuyerCompanyProfileErrors {
  const errors: BuyerCompanyProfileErrors = {};
  const country = input.country.trim();
  if (!country) {
    errors.country = "Select your country";
  } else if (isIndiaCountry(country)) {
    errors.country = "Indian buyers use the India path — no registration number needed";
  } else if (!isAllowedBuyerCountry(country)) {
    errors.country = "Select a country from the list";
  }

  const reg = validateRegistrationNumber(input.registrationNumber);
  if (!reg.ok) errors.registrationNumber = reg.error;

  const websiteRaw = input.website.trim();
  if (!websiteRaw) {
    errors.website = "Enter your company website";
  } else {
    const site = validateOptionalWebsite(websiteRaw);
    if (!site.ok) {
      errors.website = site.error.replace(" or leave blank", "");
    } else if (input.email?.trim()) {
      if (!emailMatchesWebsite(input.email, websiteRaw)) {
        errors.website = site.host
          ? `Website must match your verified email domain (${emailDomain(input.email)})`
          : "Website must match your verified company email domain";
      }
    }
  }

  return errors;
}

export function emailMatchesWebsite(
  email: string,
  website: string | null | undefined,
): boolean {
  const ed = emailDomain(email);
  if (!ed) return false;
  if (!website?.trim()) return true;
  const site = validateOptionalWebsite(website);
  if (!site.ok || !site.host) return false;
  const host = site.host;
  return ed === host || host.endsWith(`.${ed}`) || ed.endsWith(`.${host}`);
}

export type BusinessEmailResult =
  | { ok: true; email: string; domain: string }
  | { ok: false; error: string };

export function validateBusinessEmail(
  raw: string,
  website?: string | null,
): BusinessEmailResult {
  const email = raw.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return { ok: false, error: "Enter a valid business email address" };
  }
  const domain = emailDomain(email);
  if (!domain) {
    return { ok: false, error: "Enter a valid business email address" };
  }
  if (isFreeEmailDomain(domain)) {
    return {
      ok: false,
      error:
        "Use your company domain email (e.g. name@yourcompany.ae) — not Gmail, Yahoo, Outlook, or other free mail",
    };
  }
  if (website?.trim()) {
    const site = validateOptionalWebsite(website);
    if (!site.ok) {
      return { ok: false, error: site.error };
    }
    if (!emailMatchesWebsite(email, website)) {
      return {
        ok: false,
        error: site.host
          ? `Email domain must match your website (${site.host}) — or clear the website field`
          : "Email domain must match your company website — or clear the website field",
      };
    }
  }
  return { ok: true, email, domain };
}
