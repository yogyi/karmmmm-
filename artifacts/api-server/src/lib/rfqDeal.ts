import { prisma, toNumber, type Prisma } from "@workspace/db";

export type RfqWithQuotes = Prisma.RfqGetPayload<{ include: { quotes: true } }>;

export const RFQ_OPEN_STATUSES = ["pending", "responded"] as const;
export type RfqOpenStatus = (typeof RFQ_OPEN_STATUSES)[number];

export function isRfqOpenForQuotes(status: string): boolean {
  return status === "pending" || status === "responded";
}

export function isRfqClosed(status: string): boolean {
  return status === "accepted" || status === "rejected";
}

export function formatRfqQuote(q: {
  id: number;
  rfqId: number;
  supplierId: number;
  supplierName: string;
  unitPrice: Prisma.Decimal | number;
  currency: string;
  quantity: number;
  unit: string;
  leadTimeDays: number | null;
  validDays: number | null;
  paymentTerms: string | null;
  message: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  const unitPrice = toNumber(q.unitPrice) ?? 0;
  return {
    id: q.id,
    rfqId: q.rfqId,
    supplierId: q.supplierId,
    supplierName: q.supplierName,
    unitPrice,
    currency: q.currency,
    quantity: q.quantity,
    unit: q.unit,
    leadTimeDays: q.leadTimeDays,
    validDays: q.validDays,
    paymentTerms: q.paymentTerms,
    message: q.message,
    status: q.status as "active" | "withdrawn" | "awarded" | "declined",
    lineTotal: unitPrice * q.quantity,
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
  };
}

export function formatRfqDeal(r: RfqWithQuotes) {
  const quotes = [...r.quotes]
    .sort((a, b) => Number(a.unitPrice) - Number(b.unitPrice))
    .map(formatRfqQuote);
  const activeCount = quotes.filter((q) => q.status === "active" || q.status === "awarded").length;
  return {
    id: r.id,
    productId: r.productId,
    productName: r.productName,
    categoryId: r.categoryId,
    categoryName: r.categoryName,
    supplierId: r.supplierId,
    supplierName: r.supplierName,
    buyerId: r.buyerId,
    buyerName: r.buyerName,
    buyerEmail: r.buyerEmail,
    quantity: r.quantity,
    unit: r.unit,
    targetPrice: toNumber(r.targetPrice),
    description: r.description,
    status: r.status as "pending" | "responded" | "accepted" | "rejected",
    quotedPrice: toNumber(r.quotedPrice),
    sellerMessage: r.sellerMessage ?? null,
    quotedAt: r.quotedAt ? r.quotedAt.toISOString() : null,
    awardedQuoteId: r.awardedQuoteId ?? null,
    closedAt: r.closedAt ? r.closedAt.toISOString() : null,
    quoteCount: activeCount,
    quotes,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function loadRfqWithQuotes(id: number): Promise<RfqWithQuotes | null> {
  return prisma.rfq.findUnique({
    where: { id },
    include: { quotes: { orderBy: { unitPrice: "asc" } } },
  });
}

/** Sync denormalized quote summary on the RFQ row for list UIs. */
export async function refreshRfqQuoteSummary(rfqId: number): Promise<void> {
  const quotes = await prisma.rfqQuote.findMany({
    where: { rfqId, status: { in: ["active", "awarded"] } },
    orderBy: [{ status: "desc" }, { unitPrice: "asc" }, { createdAt: "desc" }],
  });
  const rfq = await prisma.rfq.findUnique({ where: { id: rfqId } });
  if (!rfq || isRfqClosed(rfq.status)) return;

  const best = quotes.find((q) => q.status === "awarded") ?? quotes[0] ?? null;
  await prisma.rfq.update({
    where: { id: rfqId },
    data: {
      quotedPrice: best?.unitPrice ?? null,
      sellerMessage: best?.message ?? null,
      quotedAt: best?.updatedAt ?? null,
      status: quotes.length > 0 ? "responded" : "pending",
    },
  });
}

export type QuoteInput = {
  unitPrice: number;
  currency?: string;
  quantity: number;
  unit: string;
  leadTimeDays?: number | null;
  validDays?: number | null;
  paymentTerms?: string | null;
  message?: string | null;
};

/**
 * Upsert one quote per supplier. Does NOT claim open marketplace RFQs —
 * supplierId on the RFQ stays null until the buyer awards a quote.
 */
export async function submitSellerQuote(opts: {
  rfqId: number;
  supplierId: number;
  supplierName: string;
  input: QuoteInput;
}): Promise<RfqWithQuotes> {
  const { rfqId, supplierId, supplierName, input } = opts;
  const rfq = await prisma.rfq.findUnique({ where: { id: rfqId } });
  if (!rfq) throw Object.assign(new Error("RFQ not found"), { status: 404 });
  if (isRfqClosed(rfq.status)) {
    throw Object.assign(new Error("This RFQ is closed — quotes are no longer accepted"), {
      status: 409,
    });
  }
  if (rfq.supplierId != null && rfq.supplierId !== supplierId) {
    throw Object.assign(new Error("Only the assigned supplier can quote this RFQ"), {
      status: 403,
    });
  }

  const unitPrice = Number(input.unitPrice);
  const quantity = Math.floor(Number(input.quantity));
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
    throw Object.assign(new Error("Unit price must be greater than 0"), { status: 400 });
  }
  if (!Number.isFinite(quantity) || quantity < 1) {
    throw Object.assign(new Error("Quantity must be at least 1"), { status: 400 });
  }

  const currency = (input.currency || "INR").trim().toUpperCase() || "INR";
  const unit = (input.unit || rfq.unit).trim() || "piece";
  const message = input.message?.trim() || null;
  const paymentTerms = input.paymentTerms?.trim() || null;
  const leadTimeDays =
    input.leadTimeDays != null && Number.isFinite(Number(input.leadTimeDays))
      ? Math.max(1, Math.floor(Number(input.leadTimeDays)))
      : null;
  const validDays =
    input.validDays != null && Number.isFinite(Number(input.validDays))
      ? Math.max(1, Math.floor(Number(input.validDays)))
      : null;

  await prisma.rfqQuote.upsert({
    where: { rfqId_supplierId: { rfqId, supplierId } },
    create: {
      rfqId,
      supplierId,
      supplierName,
      unitPrice,
      currency,
      quantity,
      unit,
      leadTimeDays,
      validDays,
      paymentTerms,
      message,
      status: "active",
    },
    update: {
      supplierName,
      unitPrice,
      currency,
      quantity,
      unit,
      leadTimeDays,
      validDays,
      paymentTerms,
      message,
      status: "active",
    },
  });

  await prisma.rfq.update({
    where: { id: rfqId },
    data: {
      status: "responded",
      quotedPrice: unitPrice,
      sellerMessage: message,
      quotedAt: new Date(),
    },
  });

  const loaded = await loadRfqWithQuotes(rfqId);
  if (!loaded) throw Object.assign(new Error("RFQ not found"), { status: 404 });
  return loaded;
}

/** Buyer awards one active quote → deal closed; other quotes declined. */
export async function awardRfqQuote(opts: {
  rfqId: number;
  quoteId: number;
  buyerId: number;
}): Promise<RfqWithQuotes> {
  const { rfqId, quoteId, buyerId } = opts;

  return prisma.$transaction(async (tx) => {
    const rfq = await tx.rfq.findUnique({ where: { id: rfqId } });
    if (!rfq) throw Object.assign(new Error("RFQ not found"), { status: 404 });
    if (rfq.buyerId !== buyerId) {
      throw Object.assign(new Error("Only the buyer can award a quote"), { status: 403 });
    }
    if (isRfqClosed(rfq.status)) {
      throw Object.assign(new Error("This RFQ is already closed"), { status: 409 });
    }

    const quote = await tx.rfqQuote.findFirst({
      where: { id: quoteId, rfqId },
    });
    if (!quote || quote.status === "withdrawn") {
      throw Object.assign(new Error("Quote not found"), { status: 404 });
    }
    if (quote.status !== "active") {
      throw Object.assign(new Error("Only an active quote can be awarded"), { status: 409 });
    }

    const now = new Date();
    await tx.rfqQuote.update({
      where: { id: quote.id },
      data: { status: "awarded" },
    });
    await tx.rfqQuote.updateMany({
      where: { rfqId, id: { not: quote.id }, status: "active" },
      data: { status: "declined" },
    });

    await tx.rfq.update({
      where: { id: rfqId },
      data: {
        status: "accepted",
        supplierId: quote.supplierId,
        supplierName: quote.supplierName,
        quotedPrice: quote.unitPrice,
        sellerMessage: quote.message,
        quotedAt: quote.updatedAt,
        awardedQuoteId: quote.id,
        closedAt: now,
      },
    });

    const loaded = await tx.rfq.findUnique({
      where: { id: rfqId },
      include: { quotes: { orderBy: { unitPrice: "asc" } } },
    });
    if (!loaded) throw Object.assign(new Error("RFQ not found"), { status: 404 });
    return loaded;
  });
}

/** Buyer cancels RFQ with no award — deal does not proceed. */
export async function closeRfqWithoutAward(opts: {
  rfqId: number;
  buyerId: number;
}): Promise<RfqWithQuotes> {
  const { rfqId, buyerId } = opts;
  return prisma.$transaction(async (tx) => {
    const rfq = await tx.rfq.findUnique({ where: { id: rfqId } });
    if (!rfq) throw Object.assign(new Error("RFQ not found"), { status: 404 });
    if (rfq.buyerId !== buyerId) {
      throw Object.assign(new Error("Only the buyer can close this RFQ"), { status: 403 });
    }
    if (rfq.status === "accepted") {
      throw Object.assign(new Error("Deal already closed — cannot reject"), { status: 409 });
    }
    if (rfq.status === "rejected") {
      const loaded = await tx.rfq.findUnique({
        where: { id: rfqId },
        include: { quotes: true },
      });
      if (!loaded) throw Object.assign(new Error("RFQ not found"), { status: 404 });
      return loaded;
    }

    const now = new Date();
    await tx.rfqQuote.updateMany({
      where: { rfqId, status: "active" },
      data: { status: "declined" },
    });
    await tx.rfq.update({
      where: { id: rfqId },
      data: { status: "rejected", closedAt: now },
    });

    const loaded = await tx.rfq.findUnique({
      where: { id: rfqId },
      include: { quotes: { orderBy: { unitPrice: "asc" } } },
    });
    if (!loaded) throw Object.assign(new Error("RFQ not found"), { status: 404 });
    return loaded;
  });
}

/** After award, mark CRM lead won for the winning supplier. */
export async function syncLeadAfterDeal(rfq: RfqWithQuotes): Promise<void> {
  if (rfq.status !== "accepted" || rfq.supplierId == null) return;
  const { upsertLeadFromRfq } = await import("../routes/leads");
  await upsertLeadFromRfq(rfq.id);
  await prisma.lead.updateMany({
    where: { rfqId: rfq.id },
    data: {
      supplierId: rfq.supplierId,
      quotationSent: true,
      requirementStatus: "won",
      dealStatus: "won",
    },
  });
}

export async function syncLeadAfterQuote(rfq: RfqWithQuotes, supplierId: number): Promise<void> {
  // Directed RFQs already have supplierId; open RFQs create/update lead only after award.
  // Still mark quotationSent when a directed shop quotes.
  if (rfq.supplierId != null && rfq.supplierId === supplierId) {
    const { upsertLeadFromRfq } = await import("../routes/leads");
    await upsertLeadFromRfq(rfq.id);
    await prisma.lead.updateMany({
      where: { rfqId: rfq.id },
      data: { quotationSent: true, requirementStatus: "quoted" },
    });
  }
}
