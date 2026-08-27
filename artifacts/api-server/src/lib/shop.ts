import { prisma } from "@workspace/db";

const RESERVED_USERNAMES = new Set([
  "admin",
  "api",
  "account",
  "buyer",
  "dashboard",
  "help",
  "karm",
  "karmbaba",
  "login",
  "me",
  "null",
  "rfq",
  "root",
  "seller",
  "shop",
  "support",
  "undefined",
  "www",
]);

/** URL-safe shop slug from company name (no database id). */
export function slugifyCompany(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "shop"
  );
}

/**
 * Normalize a seller-chosen share username (`/s/{username}`).
 * Letters, numbers, underscore, hyphen — must start with a letter.
 */
export function normalizeUsername(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/^[^a-z]+/, "")
    .slice(0, 30);
}

export function validateUsername(
  raw: string,
): { ok: true; username: string } | { ok: false; error: string } {
  const username = normalizeUsername(raw);
  if (username.length < 3) {
    return { ok: false, error: "Username must be at least 3 characters" };
  }
  if (!/^[a-z][a-z0-9_-]{2,29}$/.test(username)) {
    return {
      ok: false,
      error: "Use letters, numbers, _ or - (must start with a letter)",
    };
  }
  if (RESERVED_USERNAMES.has(username)) {
    return { ok: false, error: "That username is reserved" };
  }
  return { ok: true, username };
}

/** Build alternate usernames when the preferred one is taken (Instagram-style). */
export function buildUsernameSuggestions(
  baseRaw: string,
  taken: Set<string>,
  limit = 8,
): string[] {
  const base = normalizeUsername(baseRaw) || "seller";
  const out: string[] = [];
  const tryAdd = (candidate: string) => {
    if (out.length >= limit) return;
    const v = validateUsername(candidate);
    if (!v.ok) return;
    if (taken.has(v.username) || out.includes(v.username)) return;
    out.push(v.username);
  };

  // Prefer short, memorable variants first (like Instagram).
  for (let n = 1; n <= 99 && out.length < limit; n += 1) {
    tryAdd(`${base}${n}`);
  }
  tryAdd(`${base}_`);
  tryAdd(`${base}__`);
  tryAdd(`${base}_official`);
  tryAdd(`${base}_in`);
  tryAdd(`${base}_co`);
  tryAdd(`${base}_mart`);
  tryAdd(`${base}shop`);
  tryAdd(`${base}store`);
  tryAdd(`the${base}`);
  tryAdd(`real${base}`);
  if (base.length < 28) {
    tryAdd(`${base}${base.slice(-1)}`);
    tryAdd(`${base}${base.slice(-1)}${base.slice(-1)}`);
  }
  tryAdd(`${base}${new Date().getFullYear()}`);
  for (let i = 0; i < 50 && out.length < limit; i += 1) {
    const suffix = Math.floor(10 + Math.random() * 90);
    tryAdd(`${base}${suffix}`);
  }
  return out;
}

async function collectTakenUsernames(
  candidates: string[],
  excludeSupplierId?: number | null,
): Promise<Set<string>> {
  const unique = [...new Set(candidates.filter(Boolean))];
  if (unique.length === 0) return new Set();
  const rows = await prisma.supplier.findMany({
    where: {
      slug: { in: unique },
      ...(excludeSupplierId != null ? { NOT: { id: excludeSupplierId } } : {}),
    },
    select: { slug: true },
  });
  return new Set(rows.map((r) => r.slug).filter((s): s is string => Boolean(s)));
}

export async function checkUsernameAvailability(
  raw: string,
  excludeSupplierId?: number | null,
): Promise<{
  username: string | null;
  available: boolean;
  error?: string;
  suggestions: string[];
}> {
  const validated = validateUsername(raw);
  if (!validated.ok) {
    const draft = normalizeUsername(raw) || "seller";
    const candidates = buildUsernameSuggestions(draft, new Set([draft]), 16);
    const taken = await collectTakenUsernames(candidates, excludeSupplierId);
    return {
      username: normalizeUsername(raw) || null,
      available: false,
      error: validated.error,
      suggestions: candidates.filter((s) => !taken.has(s)).slice(0, 8),
    };
  }

  const { username } = validated;
  const clash = await prisma.supplier.findFirst({
    where: {
      slug: username,
      ...(excludeSupplierId != null ? { NOT: { id: excludeSupplierId } } : {}),
    },
    select: { id: true },
  });

  if (!clash) {
    return { username, available: true, suggestions: [] };
  }

  // Username taken — offer verified-free alternates (same base + suffix).
  const seedTaken = new Set<string>([username]);
  let suggestions: string[] = [];
  for (let round = 0; round < 3 && suggestions.length < 8; round += 1) {
    const candidates = buildUsernameSuggestions(username, seedTaken, 24);
    const taken = await collectTakenUsernames(
      [username, ...candidates],
      excludeSupplierId,
    );
    for (const c of taken) seedTaken.add(c);
    for (const c of candidates) {
      if (!seedTaken.has(c) && !suggestions.includes(c)) {
        suggestions.push(c);
      }
      if (suggestions.length >= 8) break;
    }
  }

  return {
    username,
    available: false,
    error: "Not available — try another",
    suggestions: suggestions.slice(0, 8),
  };
}

/**
 * Legacy generator always did `name-{supplierId}` (e.g. yogesh-6).
 * Those should be upgraded to a clean slug when available.
 */
export function isLegacyIdSlug(
  slug: string,
  companyName: string,
  supplierId: number,
): boolean {
  return slug === `${slugifyCompany(companyName)}-${supplierId}`;
}

/**
 * Prefer a clean company slug. Only append -2, -3, … when another shop
 * already owns that slug — never use the internal supplier id in the URL.
 */
export async function ensureUniqueSupplierSlug(
  companyName: string,
  supplierId: number,
): Promise<string> {
  const base = slugifyCompany(companyName);
  let slug = base;
  let n = 2;
  for (;;) {
    const clash = await prisma.supplier.findFirst({
      where: { slug, NOT: { id: supplierId } },
      select: { id: true },
    });
    if (!clash) return slug;
    slug = `${base}-${n}`;
    n += 1;
    if (n > 10_000) {
      // Extremely unlikely; last-resort uniqueness without advertising raw id style alone
      return `${base}-${supplierId}-${Date.now().toString(36)}`;
    }
  }
}

/**
 * Return a shareable slug for this shop: keep a good existing slug, otherwise
 * allocate a clean unique one (and upgrade legacy `name-{id}` links).
 */
export async function resolveShareableSlug(
  companyName: string,
  supplierId: number,
  currentSlug: string | null | undefined,
): Promise<string> {
  if (currentSlug && !isLegacyIdSlug(currentSlug, companyName, supplierId)) {
    return currentSlug;
  }
  return ensureUniqueSupplierSlug(companyName, supplierId);
}

export async function ensureFreeSubscription(supplierId: number): Promise<void> {
  const existing = await prisma.shopSubscription.findUnique({
    where: { supplierId },
  });
  if (existing) return;
  await prisma.shopSubscription.create({
    data: {
      supplierId,
      planCode: "free",
      status: "active",
      region: "inr",
    },
  });
}

/**
 * Subscription-first shop bootstrap: create a minimal supplier + Free plan
 * when the seller has no shop yet.
 */
export async function createShopOnFreePlan(input: {
  userId: number;
  companyName: string;
  location?: string | null;
  region?: "inr" | "usd";
}): Promise<{ supplierId: number; slug: string; planCode: string }> {
  const companyName = input.companyName.trim();
  if (companyName.length < 2) {
    throw new Error("Company name is required");
  }
  const location = (input.location?.trim() || "India").slice(0, 120);

  const created = await prisma.supplier.create({
    data: {
      companyName,
      location,
      country: "India",
      verificationStatus: "draft",
      verificationStep: 1,
      verified: false,
    },
  });
  const slug = await ensureUniqueSupplierSlug(companyName, created.id);
  await prisma.supplier.update({
    where: { id: created.id },
    data: { slug },
  });
  await prisma.user.update({
    where: { id: input.userId },
    data: {
      supplierId: created.id,
      role: "seller",
      company: companyName,
      sellerEnabled: true,
    },
  });
  await prisma.shopSubscription.upsert({
    where: { supplierId: created.id },
    create: {
      supplierId: created.id,
      planCode: "free",
      status: "active",
      region: input.region === "usd" ? "usd" : "inr",
    },
    update: {
      planCode: "free",
      status: "active",
      region: input.region === "usd" ? "usd" : "inr",
    },
  });
  return { supplierId: created.id, slug, planCode: "free" };
}

export async function getSupplierEntitlements(supplierId: number) {
  const sub = await prisma.shopSubscription.findUnique({
    where: { supplierId },
    include: { plan: true },
  });
  if (!sub || sub.status !== "active") {
    return {
      planCode: "free",
      maxProducts: 3,
      monthlyLeadQuota: 5,
      features: ["3 product listings", "Basic shop profile", "RFQ inbox"],
      status: "active" as const,
    };
  }
  return {
    planCode: sub.planCode,
    maxProducts: sub.plan.maxProducts,
    monthlyLeadQuota: sub.plan.monthlyLeadQuota,
    features: sub.plan.features,
    status: sub.status,
    periodEnd: sub.periodEnd,
  };
}

export function nextKarmId(n: number): string {
  return `KARM-${String(n).padStart(6, "0")}`;
}
