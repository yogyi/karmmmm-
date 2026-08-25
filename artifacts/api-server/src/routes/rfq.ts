import { Router, type IRouter } from "express";
import { prisma, type Prisma } from "@workspace/db";
import {
  CreateRfqBody,
  UpdateRfqBody,
  UpdateRfqParams,
  GetRfqParams,
  GetRfqResponse,
  UpdateRfqResponse,
  ListRfqsQueryParams,
  ListRfqsResponse,
} from "@workspace/api-zod";
import { requireClerkAuth } from "../lib/auth";
import {
  getAuthenticatedDbUser,
  isAdmin,
  isRfqSupplierParty,
  parseLinkedSupplierId,
} from "../lib/authorize";
import { redactRfqForViewer } from "../lib/redact";
import { sellerInboxWhere, sellerOpenMarketplaceWhere, sortRfqsForSellerInbox } from "../lib/rfqScope";
import {
  awardRfqQuote,
  closeRfqWithoutAward,
  formatRfqDeal,
  isRfqClosed,
  isRfqOpenForQuotes,
  loadRfqWithQuotes,
  submitSellerQuote,
  syncLeadAfterDeal,
  syncLeadAfterQuote,
  type RfqWithQuotes,
} from "../lib/rfqDeal";

const router: IRouter = Router();

function httpErrorStatus(err: unknown): number {
  if (err && typeof err === "object" && "status" in err) {
    const s = Number((err as { status?: number }).status);
    if (Number.isFinite(s) && s >= 400 && s < 600) return s;
  }
  return 500;
}

function formatForViewer(
  r: RfqWithQuotes,
  viewer: NonNullable<Awaited<ReturnType<typeof getAuthenticatedDbUser>>>,
) {
  return redactRfqForViewer(formatRfqDeal(r), viewer);
}

function canViewRfq(
  user: NonNullable<Awaited<ReturnType<typeof getAuthenticatedDbUser>>>,
  rfq: {
    buyerId: number | null;
    supplierId: number | null;
    status?: string | null;
    quotes?: { supplierId: number }[];
  },
): boolean {
  if (isAdmin(user)) return true;
  if (rfq.buyerId != null && rfq.buyerId === user.id) return true;
  if (isRfqSupplierParty(user, rfq.supplierId)) return true;

  const linked = parseLinkedSupplierId(user);
  if (linked != null && rfq.quotes?.some((q) => q.supplierId === linked)) return true;

  // Open marketplace RFQs while still collecting quotes
  if (
    rfq.supplierId == null &&
    isRfqOpenForQuotes(rfq.status ?? "pending") &&
    (user.role === "seller" || user.role === "admin")
  ) {
    return true;
  }
  return false;
}

function canSellerQuote(
  user: NonNullable<Awaited<ReturnType<typeof getAuthenticatedDbUser>>>,
  rfq: { supplierId: number | null; status: string },
): boolean {
  if (!isRfqOpenForQuotes(rfq.status)) return false;
  const linked = parseLinkedSupplierId(user);
  if (linked == null) return false;
  if (isAdmin(user)) return true;
  if (user.role !== "seller" && user.role !== "admin") return false;
  if (rfq.supplierId == null) return true; // open marketplace
  return rfq.supplierId === linked;
}

router.get("/rfq", requireClerkAuth, async (req, res): Promise<void> => {
  const parsed = ListRfqsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const dbUser = await getAuthenticatedDbUser(req);
  if (!dbUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const { buyerId, supplierId, status } = parsed.data;
  const where: Prisma.RfqWhereInput = {};
  if (status != null) where.status = status;

  let sellerInbox = false;

  if (isAdmin(dbUser)) {
    if (buyerId != null) where.buyerId = buyerId;
    if (supplierId != null) {
      Object.assign(where, sellerInboxWhere(supplierId, status));
      delete where.status;
      sellerInbox = true;
    } else if (buyerId == null) {
      sellerInbox = true;
    }
  } else {
    const linkedSupplierId = parseLinkedSupplierId(dbUser);

    if (buyerId != null && buyerId !== dbUser.id) {
      res.status(403).json({ error: "Forbidden — cannot list another buyer's RFQs" });
      return;
    }
    if (supplierId != null && linkedSupplierId !== supplierId) {
      res.status(403).json({ error: "Forbidden — cannot list another supplier's RFQs" });
      return;
    }

    if (buyerId != null) {
      where.buyerId = dbUser.id;
    } else if (supplierId != null && linkedSupplierId === supplierId) {
      Object.assign(where, sellerInboxWhere(linkedSupplierId, status));
      delete where.status;
      sellerInbox = true;
    } else if (linkedSupplierId != null && dbUser.role === "seller") {
      Object.assign(where, sellerInboxWhere(linkedSupplierId, status));
      delete where.status;
      sellerInbox = true;
    } else if (dbUser.role === "seller") {
      Object.assign(where, sellerOpenMarketplaceWhere(dbUser.id, status));
      delete where.status;
      sellerInbox = true;
    } else {
      where.buyerId = dbUser.id;
    }
  }

  const items = await prisma.rfq.findMany({
    where,
    include: { quotes: true },
    orderBy: { createdAt: "desc" },
  });
  const ordered = sellerInbox ? sortRfqsForSellerInbox(items) : items;
  res.json(ListRfqsResponse.parse(ordered.map((r) => formatForViewer(r, dbUser))));
});

router.post("/rfq", requireClerkAuth, async (req, res): Promise<void> => {
  const parsed = CreateRfqBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const dbUser = await getAuthenticatedDbUser(req);
  if (!dbUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const input = parsed.data;

  let supplierName: string | null = null;
  let supplierId: number | null = null;
  if (input.supplierId != null) {
    const supplier = await prisma.supplier.findUnique({
      where: { id: input.supplierId },
      select: { id: true, companyName: true },
    });
    if (!supplier) {
      res.status(400).json({ error: "Supplier not found" });
      return;
    }
    supplierId = supplier.id;
    supplierName = supplier.companyName;
  }

  let productId: number | null = null;
  let categoryId: number | null = null;
  let categoryName: string | null = null;

  if (input.categoryId != null) {
    const category = await prisma.category.findUnique({
      where: { id: input.categoryId },
      select: { id: true, name: true },
    });
    if (!category) {
      res.status(400).json({ error: "Category not found" });
      return;
    }
    categoryId = category.id;
    categoryName = category.name;
  }

  if (input.productId != null) {
    const product = await prisma.product.findUnique({
      where: { id: input.productId },
      select: {
        id: true,
        supplierId: true,
        name: true,
        categoryId: true,
        category: { select: { id: true, name: true } },
      },
    });
    if (!product) {
      res.status(400).json({ error: "Product not found" });
      return;
    }
    productId = product.id;
    if (supplierId == null && product.supplierId != null) {
      supplierId = product.supplierId;
      const supplier = await prisma.supplier.findUnique({
        where: { id: product.supplierId },
        select: { companyName: true },
      });
      supplierName = supplier?.companyName ?? null;
    }
    if (categoryId == null && product.category) {
      categoryId = product.category.id;
      categoryName = product.category.name;
    }
  }

  const quantity = Math.floor(Number(input.quantity));
  if (!Number.isFinite(quantity) || quantity < 1) {
    res.status(400).json({ error: "Quantity must be at least 1" });
    return;
  }

  const rfq = await prisma.rfq.create({
    data: {
      productId,
      productName: input.productName.trim(),
      categoryId,
      categoryName,
      supplierId,
      supplierName,
      buyerId: dbUser.id,
      buyerName: (dbUser.name || input.buyerName).trim(),
      buyerEmail: (dbUser.email || input.buyerEmail).trim(),
      quantity,
      unit: input.unit.trim() || "piece",
      targetPrice: input.targetPrice ?? null,
      description: input.description?.trim() || null,
      status: "pending",
    },
    include: { quotes: true },
  });

  try {
    const { upsertLeadFromRfq } = await import("./leads");
    await upsertLeadFromRfq(rfq.id);
  } catch (err) {
    console.warn("Failed to create CRM lead from RFQ", err);
  }

  res.status(201).json(GetRfqResponse.parse(formatForViewer(rfq, dbUser)));
});

router.get("/rfq/:id", requireClerkAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetRfqParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const dbUser = await getAuthenticatedDbUser(req);
  if (!dbUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const rfq = await loadRfqWithQuotes(params.data.id);
  if (!rfq) {
    res.status(404).json({ error: "RFQ not found" });
    return;
  }
  if (!canViewRfq(dbUser, rfq)) {
    res.status(403).json({ error: "Forbidden — you cannot view this RFQ" });
    return;
  }

  res.json(GetRfqResponse.parse(formatForViewer(rfq, dbUser)));
});

/** Seller submits / updates a competitive quote (does not claim open RFQs). */
router.post("/rfq/:id/quotes", requireClerkAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rfqId = parseInt(String(rawId), 10);
  if (!Number.isFinite(rfqId)) {
    res.status(400).json({ error: "Invalid RFQ id" });
    return;
  }

  const dbUser = await getAuthenticatedDbUser(req);
  if (!dbUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const existing = await prisma.rfq.findUnique({ where: { id: rfqId } });
  if (!existing) {
    res.status(404).json({ error: "RFQ not found" });
    return;
  }
  if (!canSellerQuote(dbUser, existing) && !isAdmin(dbUser)) {
    res.status(403).json({ error: "Forbidden — you cannot quote this RFQ" });
    return;
  }

  const linkedSupplierId = parseLinkedSupplierId(dbUser);
  if (linkedSupplierId == null) {
    res.status(400).json({ error: "Link a supplier shop before sending quotes" });
    return;
  }

  const shop = await prisma.supplier.findUnique({
    where: { id: linkedSupplierId },
    select: { companyName: true },
  });
  if (!shop) {
    res.status(400).json({ error: "Supplier shop not found" });
    return;
  }

  const body = req.body as Record<string, unknown>;
  try {
    const updated = await submitSellerQuote({
      rfqId,
      supplierId: linkedSupplierId,
      supplierName: shop.companyName,
      input: {
        unitPrice: Number(body.unitPrice),
        currency: typeof body.currency === "string" ? body.currency : "INR",
        quantity: Number(body.quantity ?? existing.quantity),
        unit: typeof body.unit === "string" ? body.unit : existing.unit,
        leadTimeDays: body.leadTimeDays != null ? Number(body.leadTimeDays) : null,
        validDays: body.validDays != null ? Number(body.validDays) : null,
        paymentTerms: typeof body.paymentTerms === "string" ? body.paymentTerms : null,
        message: typeof body.message === "string" ? body.message : null,
      },
    });
    try {
      await syncLeadAfterQuote(updated, linkedSupplierId);
    } catch (err) {
      console.warn("Lead sync after quote failed", err);
    }
    res.status(200).json(GetRfqResponse.parse(formatForViewer(updated, dbUser)));
  } catch (err) {
    res.status(httpErrorStatus(err)).json({
      error: err instanceof Error ? err.message : "Failed to submit quote",
    });
  }
});

/** Buyer awards one quote → deal closed. */
router.post("/rfq/:id/award", requireClerkAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rfqId = parseInt(String(rawId), 10);
  if (!Number.isFinite(rfqId)) {
    res.status(400).json({ error: "Invalid RFQ id" });
    return;
  }

  const dbUser = await getAuthenticatedDbUser(req);
  if (!dbUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const quoteId = Number((req.body as { quoteId?: number })?.quoteId);
  if (!Number.isFinite(quoteId) || quoteId < 1) {
    res.status(400).json({ error: "quoteId is required" });
    return;
  }

  try {
    const updated = await awardRfqQuote({
      rfqId,
      quoteId,
      buyerId: dbUser.id,
    });
    try {
      await syncLeadAfterDeal(updated);
    } catch (err) {
      console.warn("Lead sync after award failed", err);
    }
    res.json(GetRfqResponse.parse(formatForViewer(updated, dbUser)));
  } catch (err) {
    res.status(httpErrorStatus(err)).json({
      error: err instanceof Error ? err.message : "Failed to award quote",
    });
  }
});

router.patch("/rfq/:id", requireClerkAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateRfqParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateRfqBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const dbUser = await getAuthenticatedDbUser(req);
  if (!dbUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const existing = await loadRfqWithQuotes(params.data.id);
  if (!existing) {
    res.status(404).json({ error: "RFQ not found" });
    return;
  }

  const isBuyer = existing.buyerId === dbUser.id;
  const linkedSupplierId = parseLinkedSupplierId(dbUser);
  const admin = isAdmin(dbUser);
  const body = parsed.data as {
    status?: "pending" | "responded" | "accepted" | "rejected";
    supplierName?: string;
    sellerMessage?: string;
    quotedPrice?: number;
    awardQuoteId?: number;
  };

  // Prefer explicit award
  if (body.awardQuoteId != null) {
    if (!admin && !isBuyer) {
      res.status(403).json({ error: "Only the buyer can award a quote" });
      return;
    }
    try {
      const updated = await awardRfqQuote({
        rfqId: existing.id,
        quoteId: body.awardQuoteId,
        buyerId: existing.buyerId ?? dbUser.id,
      });
      try {
        await syncLeadAfterDeal(updated);
      } catch (err) {
        console.warn("Lead sync after award failed", err);
      }
      res.json(UpdateRfqResponse.parse(formatForViewer(updated, dbUser)));
    } catch (err) {
      res.status(httpErrorStatus(err)).json({
        error: err instanceof Error ? err.message : "Failed to award quote",
      });
    }
    return;
  }

  // Legacy seller quote via PATCH → route through multi-quote upsert
  if (body.quotedPrice != null || body.sellerMessage != null) {
    if (!canSellerQuote(dbUser, existing) && !admin) {
      res.status(403).json({ error: "Forbidden — you cannot quote this RFQ" });
      return;
    }
    if (linkedSupplierId == null) {
      res.status(400).json({ error: "Link a supplier shop before sending quotes" });
      return;
    }
    const shop = await prisma.supplier.findUnique({
      where: { id: linkedSupplierId },
      select: { companyName: true },
    });
    try {
      const updated = await submitSellerQuote({
        rfqId: existing.id,
        supplierId: linkedSupplierId,
        supplierName: shop?.companyName ?? body.supplierName ?? "Supplier",
        input: {
          unitPrice: Number(body.quotedPrice ?? existing.quotedPrice ?? 0),
          quantity: existing.quantity,
          unit: existing.unit,
          message: body.sellerMessage ?? null,
        },
      });
      try {
        await syncLeadAfterQuote(updated, linkedSupplierId);
      } catch (err) {
        console.warn("Lead sync after quote failed", err);
      }
      res.json(UpdateRfqResponse.parse(formatForViewer(updated, dbUser)));
    } catch (err) {
      res.status(httpErrorStatus(err)).json({
        error: err instanceof Error ? err.message : "Failed to submit quote",
      });
    }
    return;
  }

  // Status transitions
  if (body.status != null) {
    if (admin) {
      if (body.status === "accepted" && existing.quotes.length === 1) {
        try {
          const updated = await awardRfqQuote({
            rfqId: existing.id,
            quoteId: existing.quotes[0]!.id,
            buyerId: existing.buyerId ?? dbUser.id,
          });
          res.json(UpdateRfqResponse.parse(formatForViewer(updated, dbUser)));
        } catch (err) {
          res.status(httpErrorStatus(err)).json({
            error: err instanceof Error ? err.message : "Failed to accept",
          });
        }
        return;
      }
      if (body.status === "rejected") {
        try {
          const updated = await closeRfqWithoutAward({
            rfqId: existing.id,
            buyerId: existing.buyerId ?? dbUser.id,
          });
          res.json(UpdateRfqResponse.parse(formatForViewer(updated, dbUser)));
        } catch (err) {
          res.status(httpErrorStatus(err)).json({
            error: err instanceof Error ? err.message : "Failed to close",
          });
        }
        return;
      }
      if (isRfqClosed(existing.status) && body.status !== existing.status) {
        res.status(409).json({ error: "Closed deals cannot be reopened via status change" });
        return;
      }
      const rfq = await prisma.rfq.update({
        where: { id: existing.id },
        data: { status: body.status },
        include: { quotes: true },
      });
      res.json(UpdateRfqResponse.parse(formatForViewer(rfq, dbUser)));
      return;
    }

    if (isBuyer && body.status === "accepted") {
      const active = existing.quotes.filter((q) => q.status === "active");
      if (active.length === 0) {
        res.status(400).json({ error: "No quotes to accept — wait for a seller reply" });
        return;
      }
      if (active.length > 1) {
        res.status(400).json({
          error: "Multiple quotes received — award a specific quote",
        });
        return;
      }
      try {
        const updated = await awardRfqQuote({
          rfqId: existing.id,
          quoteId: active[0]!.id,
          buyerId: dbUser.id,
        });
        try {
          await syncLeadAfterDeal(updated);
        } catch (err) {
          console.warn("Lead sync after award failed", err);
        }
        res.json(UpdateRfqResponse.parse(formatForViewer(updated, dbUser)));
      } catch (err) {
        res.status(httpErrorStatus(err)).json({
          error: err instanceof Error ? err.message : "Failed to accept quote",
        });
      }
      return;
    }

    if (isBuyer && body.status === "rejected") {
      try {
        const updated = await closeRfqWithoutAward({
          rfqId: existing.id,
          buyerId: dbUser.id,
        });
        res.json(UpdateRfqResponse.parse(formatForViewer(updated, dbUser)));
      } catch (err) {
        res.status(httpErrorStatus(err)).json({
          error: err instanceof Error ? err.message : "Failed to close RFQ",
        });
      }
      return;
    }

    res.status(403).json({ error: "Forbidden — invalid status change for your role" });
    return;
  }

  res.status(400).json({ error: "No valid update fields provided" });
});

export default router;
