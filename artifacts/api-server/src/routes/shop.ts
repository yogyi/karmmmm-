import { Router, type IRouter } from "express";
import { prisma } from "@workspace/db";
import { requireClerkAuth } from "../lib/auth";
import {
  getAuthenticatedDbUser,
  isAdmin,
  isSellerOrAdmin,
  parseLinkedSupplierId,
} from "../lib/authorize";
import {
  createShopOnFreePlan,
  ensureFreeSubscription,
  getSupplierEntitlements,
} from "../lib/shop";

const router: IRouter = Router();

router.get("/plans", async (_req, res): Promise<void> => {
  const plans = await prisma.plan.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });
  res.json({
    items: plans.map((p) => ({
      code: p.code,
      name: p.name,
      description: p.description,
      maxProducts: p.maxProducts,
      monthlyLeadQuota: p.monthlyLeadQuota,
      features: p.features,
      priceInrMonthly: p.priceInrMonthly,
      priceInrYearly: p.priceInrYearly,
      priceUsdMonthly: p.priceUsdMonthly,
      priceUsdYearly: p.priceUsdYearly,
    })),
  });
});

/**
 * Subscription-based shop setup.
 * Creates a Free shop when the seller has none yet (company name required).
 * Paid tiers still require admin / payment — not self-activated here.
 */
router.post("/shop/setup", requireClerkAuth, async (req, res): Promise<void> => {
  const dbUser = await getAuthenticatedDbUser(req);
  if (!dbUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  // Shop bootstrap is for seller workspace only (or admin). Pure buyers must activate
  // seller side via onboarding/login before creating a shop.
  if (
    !isAdmin(dbUser) &&
    dbUser.role !== "seller" &&
    dbUser.sellerEnabled !== true
  ) {
    res.status(403).json({
      error:
        "Activate a seller account from login/register before opening a shop.",
    });
    return;
  }

  const body = req.body as {
    companyName?: string;
    location?: string;
    region?: string;
    planCode?: string;
  };
  const planCode = (body.planCode ?? "free").trim() || "free";
  if (planCode !== "free" && !isAdmin(dbUser)) {
    res.status(402).json({
      error:
        "Start on Free. Paid plans require payment or Karm Baba sales approval.",
    });
    return;
  }

  let supplierId = parseLinkedSupplierId(dbUser);
  if (supplierId == null) {
    const companyName =
      (typeof body.companyName === "string" && body.companyName.trim()) ||
      dbUser.company?.trim() ||
      "";
    if (!companyName) {
      res.status(400).json({ error: "companyName is required to open your shop" });
      return;
    }
    try {
      const created = await createShopOnFreePlan({
        userId: dbUser.id,
        companyName,
        location: body.location,
        region: body.region === "usd" ? "usd" : "inr",
      });
      supplierId = created.supplierId;
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Could not create shop",
      });
      return;
    }
  } else {
    await ensureFreeSubscription(supplierId);
  }

  const entitlements = await getSupplierEntitlements(supplierId);
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    select: { id: true, companyName: true, slug: true, verificationStatus: true },
  });
  const productCount = await prisma.product.count({ where: { supplierId } });
  const leadCount = await prisma.lead.count({
    where: {
      supplierId,
      createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
    },
  });

  res.status(201).json({
    ...entitlements,
    supplierId,
    companyName: supplier?.companyName ?? null,
    slug: supplier?.slug ?? null,
    verificationStatus: supplier?.verificationStatus ?? "draft",
    productCount,
    leadCountThisMonth: leadCount,
    next: "/seller",
    message:
      "Free shop is active. Add products anytime; finish GST verification for the verified badge.",
  });
});

router.get("/shop/subscription", requireClerkAuth, async (req, res): Promise<void> => {
  const dbUser = await getAuthenticatedDbUser(req);
  if (!dbUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const supplierId = parseLinkedSupplierId(dbUser);
  if (supplierId == null) {
    res.status(404).json({ error: "No shop linked" });
    return;
  }
  const entitlements = await getSupplierEntitlements(supplierId);
  const productCount = await prisma.product.count({ where: { supplierId } });
  const leadCount = await prisma.lead.count({
    where: {
      supplierId,
      createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
    },
  });
  res.json({
    ...entitlements,
    productCount,
    leadCountThisMonth: leadCount,
  });
});

/**
 * Assign a plan. Paid tiers are admin-only until payment is wired.
 * Sellers may only keep/reset to free. Use /shop/setup to create a shop first.
 */
router.post("/shop/subscription", requireClerkAuth, async (req, res): Promise<void> => {
  const dbUser = await getAuthenticatedDbUser(req);
  if (!dbUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const body = req.body as { planCode?: string; supplierId?: number; region?: string };
  const planCode = body.planCode?.trim();
  if (!planCode) {
    res.status(400).json({ error: "planCode is required" });
    return;
  }

  const plan = await prisma.plan.findUnique({ where: { code: planCode } });
  if (!plan || !plan.active) {
    res.status(404).json({ error: "Plan not found" });
    return;
  }

  let supplierId = parseLinkedSupplierId(dbUser);
  if (isAdmin(dbUser) && body.supplierId) {
    supplierId = body.supplierId;
  }
  if (supplierId == null) {
    res.status(400).json({
      error: "No shop yet — use POST /shop/setup to open a Free shop first",
    });
    return;
  }
  if (!isAdmin(dbUser) && !isSellerOrAdmin(dbUser)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (!isAdmin(dbUser) && planCode !== "free") {
    res.status(402).json({
      error:
        "Paid plans require payment or Karm Baba sales approval. Self-activation is disabled.",
    });
    return;
  }

  const periodEnd =
    planCode === "free" ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const sub = await prisma.shopSubscription.upsert({
    where: { supplierId },
    create: {
      supplierId,
      planCode,
      status: "active",
      region: body.region === "usd" ? "usd" : "inr",
      periodEnd,
    },
    update: {
      planCode,
      status: "active",
      region: body.region === "usd" ? "usd" : "inr",
      periodStart: new Date(),
      periodEnd,
    },
    include: { plan: true },
  });

  res.json({
    planCode: sub.planCode,
    status: sub.status,
    maxProducts: sub.plan.maxProducts,
    monthlyLeadQuota: sub.plan.monthlyLeadQuota,
    features: sub.plan.features,
    periodEnd: sub.periodEnd?.toISOString() ?? null,
  });
});

export default router;
