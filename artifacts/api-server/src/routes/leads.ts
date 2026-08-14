import { Router, type IRouter } from "express";
import { prisma, toNumber } from "@workspace/db";
import { requireClerkAuth } from "../lib/auth";
import {
  canAccessSupplier,
  getAuthenticatedDbUser,
  isAdmin,
  isSellerOrAdmin,
  parseLinkedSupplierId,
} from "../lib/authorize";
import { nextKarmId, getSupplierEntitlements } from "../lib/shop";
import { rateLimit } from "../lib/rateLimit";

const router: IRouter = Router();
const publicLeadLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });

async function createLeadWithQuota(data: {
  supplierId: number;
  buyerId?: number | null;
  rfqId?: number | null;
  name: string;
  company?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  productInterest?: string | null;
  avgMonthlyQty?: string | null;
  leadSource?: string | null;
  comments?: string | null;
  industry?: string | null;
}) {
  const entitlements = await getSupplierEntitlements(data.supplierId);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const leadCount = await prisma.lead.count({
    where: { supplierId: data.supplierId, createdAt: { gte: monthStart } },
  });
  if (leadCount >= entitlements.monthlyLeadQuota) {
    const err = new Error("LEAD_QUOTA") as Error & { code: string };
    err.code = "LEAD_QUOTA";
    throw err;
  }
  const count = await prisma.lead.count();
  return prisma.lead.create({
    data: {
      karmId: nextKarmId(count + 1),
      supplierId: data.supplierId,
      buyerId: data.buyerId ?? null,
      rfqId: data.rfqId ?? null,
      name: data.name,
      company: data.company ?? null,
      country: data.country ?? null,
      phone: data.phone ?? null,
      email: data.email ?? null,
      productInterest: data.productInterest ?? null,
      avgMonthlyQty: data.avgMonthlyQty ?? null,
      leadSource: data.leadSource ?? null,
      comments: data.comments ?? null,
      industry: data.industry ?? null,
      requirementStatus: "new",
    },
  });
}

function mapLead(l: {
  id: number;
  karmId: string;
  supplierId: number | null;
  buyerId: number | null;
  rfqId: number | null;
  name: string;
  company: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  productInterest: string | null;
  avgMonthlyQty: string | null;
  leadSource: string | null;
  requirementStatus: string;
  quotationSent: boolean;
  dealStatus: string;
  followUpAt: Date | null;
  assignedTo: string | null;
  comments: string | null;
  lostReason: string | null;
  industry: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...l,
    followUpAt: l.followUpAt?.toISOString() ?? null,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  };
}

/** Share-card inquiry — signed-in Karm users only. */
router.post("/leads/public", requireClerkAuth, publicLeadLimiter, async (req, res): Promise<void> => {
  const dbUser = await getAuthenticatedDbUser(req);
  if (!dbUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const body = req.body as {
    supplierSlug?: string;
    supplierId?: number;
    name?: string;
    company?: string;
    email?: string;
    phone?: string;
    country?: string;
    productInterest?: string;
    message?: string;
  };
  if (!body.name?.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  if (!body.email?.trim() && !body.phone?.trim()) {
    res.status(400).json({ error: "email or phone is required" });
    return;
  }

  let supplierId = body.supplierId;
  if (body.supplierSlug) {
    const s = await prisma.supplier.findUnique({
      where: { slug: body.supplierSlug },
      select: { id: true },
    });
    supplierId = s?.id;
  }
  if (supplierId == null || Number.isNaN(supplierId)) {
    res.status(404).json({ error: "Supplier not found" });
    return;
  }

  try {
    const lead = await createLeadWithQuota({
      supplierId,
      buyerId: dbUser.id,
      name: body.name.trim(),
      company: body.company?.trim() || null,
      email: body.email?.trim() || null,
      phone: body.phone?.trim() || null,
      country: body.country?.trim() || null,
      productInterest: body.productInterest?.trim() || null,
      comments: body.message?.trim() || null,
      leadSource: "share_card",
    });
    res.status(201).json({
      ok: true,
      karmId: lead.karmId,
      message: "Inquiry received. The seller will follow up shortly.",
    });
  } catch (e) {
    if ((e as { code?: string }).code === "LEAD_QUOTA") {
      res.status(429).json({
        error: "This seller has reached their monthly inquiry limit. Try again next month or contact them another way.",
      });
      return;
    }
    throw e;
  }
});

/** List CRM leads for the seller's shop (or all for admin). */
router.get("/leads", requireClerkAuth, async (req, res): Promise<void> => {
  const dbUser = await getAuthenticatedDbUser(req);
  if (!dbUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (!isSellerOrAdmin(dbUser)) {
    res.status(403).json({ error: "Forbidden — sellers only" });
    return;
  }

  const supplierId = isAdmin(dbUser)
    ? req.query.supplierId
      ? Number(req.query.supplierId)
      : undefined
    : parseLinkedSupplierId(dbUser);

  if (!isAdmin(dbUser) && supplierId == null) {
    res.json({ items: [], total: 0 });
    return;
  }

  const status =
    typeof req.query.status === "string" ? req.query.status : undefined;

  const where = {
    ...(supplierId != null ? { supplierId } : {}),
    ...(status ? { requirementStatus: status } : {}),
  };

  const [total, items] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
  ]);

  res.json({ items: items.map(mapLead), total });
});

router.get("/leads/:id", requireClerkAuth, async (req, res): Promise<void> => {
  const dbUser = await getAuthenticatedDbUser(req);
  if (!dbUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const id = parseInt(String(req.params.id), 10);
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      activities: { orderBy: { createdAt: "desc" }, take: 50 },
      quotations: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  if (
    !isAdmin(dbUser) &&
    (lead.supplierId == null || !canAccessSupplier(dbUser, lead.supplierId))
  ) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  res.json({
    ...mapLead(lead),
    activities: lead.activities.map((a) => ({
      ...a,
      followUpAt: a.followUpAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
    })),
    quotations: lead.quotations.map((q) => ({
      ...q,
      unitPrice: toNumber(q.unitPrice),
      validTill: q.validTill?.toISOString() ?? null,
      createdAt: q.createdAt.toISOString(),
    })),
  });
});

router.patch("/leads/:id", requireClerkAuth, async (req, res): Promise<void> => {
  const dbUser = await getAuthenticatedDbUser(req);
  if (!dbUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const id = parseInt(String(req.params.id), 10);
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  if (
    !isAdmin(dbUser) &&
    (lead.supplierId == null || !canAccessSupplier(dbUser, lead.supplierId))
  ) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const body = req.body as Record<string, unknown>;
  const updated = await prisma.lead.update({
    where: { id },
    data: {
      ...(typeof body.requirementStatus === "string"
        ? { requirementStatus: body.requirementStatus }
        : {}),
      ...(typeof body.dealStatus === "string" ? { dealStatus: body.dealStatus } : {}),
      ...(typeof body.comments === "string" ? { comments: body.comments } : {}),
      ...(typeof body.assignedTo === "string" ? { assignedTo: body.assignedTo } : {}),
      ...(typeof body.lostReason === "string" ? { lostReason: body.lostReason } : {}),
      ...(body.followUpAt
        ? { followUpAt: new Date(String(body.followUpAt)) }
        : body.followUpAt === null
          ? { followUpAt: null }
          : {}),
      ...(typeof body.quotationSent === "boolean"
        ? { quotationSent: body.quotationSent }
        : {}),
    },
  });
  res.json(mapLead(updated));
});

router.post(
  "/leads/:id/activities",
  requireClerkAuth,
  async (req, res): Promise<void> => {
    const dbUser = await getAuthenticatedDbUser(req);
    if (!dbUser) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const id = parseInt(String(req.params.id), 10);
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      res.status(404).json({ error: "Lead not found" });
      return;
    }
    if (
      !isAdmin(dbUser) &&
      (lead.supplierId == null || !canAccessSupplier(dbUser, lead.supplierId))
    ) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const body = req.body as {
      mode?: string;
      subject?: string;
      summary?: string;
      nextAction?: string;
      followUpAt?: string;
    };
    if (!body.summary?.trim()) {
      res.status(400).json({ error: "summary is required" });
      return;
    }

    const activity = await prisma.leadActivity.create({
      data: {
        leadId: id,
        mode: body.mode || "note",
        subject: body.subject?.trim() || null,
        summary: body.summary.trim(),
        nextAction: body.nextAction?.trim() || null,
        followUpAt: body.followUpAt ? new Date(body.followUpAt) : null,
        handledBy: dbUser.name,
      },
    });

    if (body.followUpAt) {
      await prisma.lead.update({
        where: { id },
        data: { followUpAt: new Date(body.followUpAt) },
      });
    }

    res.status(201).json({
      ...activity,
      followUpAt: activity.followUpAt?.toISOString() ?? null,
      createdAt: activity.createdAt.toISOString(),
    });
  },
);

router.post(
  "/leads/:id/quotations",
  requireClerkAuth,
  async (req, res): Promise<void> => {
    const dbUser = await getAuthenticatedDbUser(req);
    if (!dbUser) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const id = parseInt(String(req.params.id), 10);
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      res.status(404).json({ error: "Lead not found" });
      return;
    }
    if (
      !isAdmin(dbUser) &&
      (lead.supplierId == null || !canAccessSupplier(dbUser, lead.supplierId))
    ) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const body = req.body as {
      productName?: string;
      quantity?: number;
      unitPrice?: number;
      currency?: string;
      incoterms?: string;
      validTill?: string;
      notes?: string;
      sentVia?: string;
    };
    if (!body.productName?.trim()) {
      res.status(400).json({ error: "productName is required" });
      return;
    }

    const quote = await prisma.quotation.create({
      data: {
        leadId: id,
        productName: body.productName.trim(),
        quantity: body.quantity ?? null,
        unitPrice: body.unitPrice ?? null,
        currency: body.currency || "INR",
        incoterms: body.incoterms || null,
        validTill: body.validTill ? new Date(body.validTill) : null,
        notes: body.notes || null,
        sentVia: body.sentVia || null,
        status: body.sentVia ? "sent" : "draft",
      },
    });

    await prisma.lead.update({
      where: { id },
      data: {
        quotationSent: true,
        requirementStatus: "quoted",
      },
    });

    res.status(201).json({
      ...quote,
      unitPrice: toNumber(quote.unitPrice),
      validTill: quote.validTill?.toISOString() ?? null,
      createdAt: quote.createdAt.toISOString(),
    });
  },
);

/** Create a lead from an RFQ (idempotent). */
export async function upsertLeadFromRfq(rfqId: number): Promise<void> {
  const rfq = await prisma.rfq.findUnique({ where: { id: rfqId } });
  if (!rfq || rfq.supplierId == null) return;

  const existing = await prisma.lead.findUnique({ where: { rfqId } });
  if (existing) return;

  try {
    await createLeadWithQuota({
      supplierId: rfq.supplierId,
      buyerId: rfq.buyerId,
      rfqId: rfq.id,
      name: rfq.buyerName,
      email: rfq.buyerEmail,
      productInterest: rfq.productName,
      avgMonthlyQty: `${rfq.quantity} ${rfq.unit}`,
      leadSource: "rfq",
      comments: rfq.description,
    });
  } catch (e) {
    if ((e as { code?: string }).code === "LEAD_QUOTA") {
      console.warn(`Lead quota exceeded for supplier ${rfq.supplierId}; RFQ ${rfqId} not mirrored to CRM`);
      return;
    }
    throw e;
  }
}

export default router;
