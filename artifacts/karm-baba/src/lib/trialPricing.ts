/** Fixed promotional trial prices — matches shop plans pattern (not live FX). */
export const TRIAL_PRICE_INR = 99;

export type TrialCurrency = "INR" | "USD" | "GBP" | "EUR" | "AED";

export const TRIAL_PRICES: Record<TrialCurrency, number> = {
  INR: 99,
  USD: 1.19,
  GBP: 0.99,
  EUR: 1.09,
  AED: 4.49,
};

export const TRIAL_CURRENCY_LABELS: Record<TrialCurrency, string> = {
  INR: "₹ INR",
  USD: "$ USD",
  GBP: "£ GBP",
  EUR: "€ EUR",
  AED: "د.إ AED",
};

const EU_LOCALES = ["de", "fr", "es", "it", "nl", "pt", "pl", "sv", "da", "fi"];

/** Best-effort default currency from browser locale / timezone. */
export function detectDefaultCurrency(): TrialCurrency {
  if (typeof navigator === "undefined") return "INR";

  const locale = (navigator.language || "").toLowerCase();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";

  if (
    locale.includes("-in") ||
    locale === "hi" ||
    tz.includes("Kolkata") ||
    tz.includes("Calcutta") ||
    tz.includes("Asia/Kolkata")
  ) {
    return "INR";
  }
  if (locale.includes("-gb") || tz.includes("London")) return "GBP";
  if (locale.includes("-ae") || tz.includes("Dubai")) return "AED";
  if (EU_LOCALES.some((l) => locale.startsWith(l))) return "EUR";
  return "USD";
}

export function currencyFromCountry(country: string | null | undefined): TrialCurrency {
  const c = (country ?? "").trim().toLowerCase();
  if (!c || c === "india" || c === "in") return "INR";
  if (c.includes("united kingdom") || c === "uk" || c === "gb") return "GBP";
  if (c.includes("emirates") || c === "uae" || c === "ae") return "AED";
  if (
    ["germany", "france", "spain", "italy", "netherlands", "belgium", "austria"].some(
      (n) => c.includes(n),
    )
  ) {
    return "EUR";
  }
  return "USD";
}

export function formatTrialPrice(currency: TrialCurrency): string {
  const value = TRIAL_PRICES[currency];
  const locale =
    currency === "INR" ? "en-IN" : currency === "GBP" ? "en-GB" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: currency === "INR" ? 0 : 2,
    maximumFractionDigits: currency === "INR" ? 0 : 2,
  }).format(value);
}

export function trialRegisterUrl(): string {
  return "/register?mode=seller&trial=1";
}
