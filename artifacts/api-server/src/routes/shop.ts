import { Router, type IRouter } from "express";
import { prisma } from "@workspace/db";
import { requireClerkAuth } from "../lib/auth";
import {
  getAuthenticatedDbUser,
  isAdmin,
  isSellerOrAdmin,
  parseLinkedSupplierId,
} from "../lib/authorize";
import { getSupplierEntitlements } from "../lib/shop";

const router: IRouter = Router();

router.get("/plans", requireClerkAuth, async (_req, res): Promise<void> => {
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

/** Manual plan assign (admin) or self-upgrade stub until payment gateway. */
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
    res.status(400).json({ error: "No shop to upgrade" });
    return;
  }
  if (!isAdmin(dbUser) && !isSellerOrAdmin(dbUser)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  // Non-admins may only move onto free/pro_trade without payment for now;
  // business/enterprise require admin until Razorpay is wired.
  if (!isAdmin(dbUser) && !["free", "pro_trade"].includes(planCode)) {
    res.status(402).json({
      error:
        "Contact Karm Baba sales to activate Business/Enterprise. Pro Trade can be enabled for testing.",
    });
    return;
  }

  const periodEnd =
    planCode === "free"
      ? null
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

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
