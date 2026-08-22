import { prisma } from "@workspace/db";

export function slugifyCompany(name: string, id?: number): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "shop";
  return id != null ? `${base}-${id}` : base;
}

export async function ensureUniqueSupplierSlug(
  companyName: string,
  supplierId: number,
): Promise<string> {
  let slug = slugifyCompany(companyName, supplierId);
  const clash = await prisma.supplier.findFirst({
    where: { slug, NOT: { id: supplierId } },
  });
  if (clash) slug = `${slug}-${Date.now().toString(36)}`;
  return slug;
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
    data: { supplierId: created.id, role: "seller", company: companyName },
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
