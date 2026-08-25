/**
 * Overseas KYC: company-domain email instead of GST/PAN.
 * Keep in sync with api-server/src/lib/businessEmail.ts
 */

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

export function emailMatchesWebsite(
  email: string,
  website: string | null | undefined,
): boolean {
  const ed = emailDomain(email);
  const host = websiteHost(website);
  if (!ed || !host) return true;
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
  if (website?.trim() && !emailMatchesWebsite(email, website)) {
    const host = websiteHost(website);
    return {
      ok: false,
      error: host
        ? `Email domain must match your website (${host})`
        : "Email domain must match your company website",
    };
  }
  return { ok: true, email, domain };
}
