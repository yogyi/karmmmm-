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
  confirmRfqDeal,
  declinePendingRfqConfirm,
  formatRfqDeal,
  isRfqAwaitingSellerConfirm,
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
    openMarketplace?: boolean | null;
    quotes?: { supplierId: number }[];
  },
): boolean {
  if (isAdmin(user)) return true;

  // Own RFQs belong in buyer mode — sellers must switch role to manage them.
  if (rfq.buyerId != null && rfq.buyerId === user.id) {
    return user.role !== "seller";
  }

  if (isRfqSupplierParty(user, rfq.supplierId)) return true;

  const linked = parseLinkedSupplierId(user);
  if (linked != null && rfq.quotes?.some((q) => q.supplierId === linked)) {
    return user.role === "seller" || user.role === "admin";
  }

  // Open marketplace: collecting, handshake, or closed — seller mode only
  if (
    user.role === "seller" &&
    (rfq.openMarketplace === true || rfq.supplierId == null) &&
    (isRfqOpenForQuotes(rfq.status ?? "pending") ||
      isRfqAwaitingSellerConfirm(rfq.status ?? "") ||
      rfq.status === "accepted")
  ) {
    return true;
  }
  return false;
}

function canSellerQuote(
  user: NonNullable<Awaited<ReturnType<typeof getAuthenticatedDbUser>>>,
  rfq: { buyerId: number | null; supplierId: number | null; status: string },
): boolean {
  if (!isRfqOpenForQuotes(rfq.status)) return false;
  // Never quote on your own buyer RFQ
  if (rfq.buyerId != null && rfq.buyerId === user.id) return false;
  const linked = parseLinkedSupplierId(user);
  if (linked == null) return false;
  if (isAdmin(user)) return true;
  if (user.role !== "seller" && user.role !== "admin") return false;
  if (rfq.supplierId == null) return true; // open marketplace
  return rfq.supplierId === linked;
}

/** Verified sellers only — matches buyer-facing “verified suppliers” promise. */
async function assertSellerVerifiedToQuote(
  supplierId: number,
  isAdminUser: boolean,
): Promise<{ ok: true; companyName: string } | { ok: false; status: number; error: string }> {
  const shop = await prisma.supplier.findUnique({
    where: { id: supplierId },
    select: { companyName: true, verified: true, verificationStatus: true },
  });
  if (!shop) {
    return { ok: false, status: 400, error: "Supplier shop not found" };
  }
  if (isAdminUser) {
    return { ok: true, companyName: shop.companyName };
  }
  const verified =
    shop.verified === true || shop.verificationStatus === "verified";
  if (!verified) {
    const pending = shop.verificationStatus === "pending";
    return {
      ok: false,
      status: 403,
      error: pending
        ? "Your verification is under review. You can quote buyers after Karm Baba approves your shop."
        : "Complete seller verification before sending quotes. Buyers only receive quotes from verified suppliers.",
    };
  }
  return { ok: true, companyName: shop.companyName };
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
      Object.assign(where, sellerInboxWhere(supplierId, status, null));
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

    // Role-strict listing: buyer mode → own RFQs only; seller mode → inbox only.
    // Exception: seller may pass buyerId=self to list RFQs they posted as a buyer
    // (Incoming inbox still excludes those so they cannot quote themselves).
    if (dbUser.role === "seller") {
      if (buyerId != null && buyerId === dbUser.id) {
        where.buyerId = dbUser.id;
      } else if (linkedSupplierId != null) {
        Object.assign(where, sellerInboxWhere(linkedSupplierId, status, dbUser.id));
        delete where.status;
        sellerInbox = true;
      } else {
        Object.assign(where, sellerOpenMarketplaceWhere(status));
        delete where.status;
        sellerInbox = true;
      }
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
  if (dbUser.role === "seller") {
    res.status(403).json({
      error: "Switch to buyer mode to post RFQs. Seller mode is for incoming quotes only.",
    });
    return;
  }
  if (!dbUser.buyerKycCompleted) {
    res.status(403).json({
      error: "Complete buyer verification first (about 2 minutes).",
      code: "BUYER_KYC_REQUIRED",
    });
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
    if (parseLinkedSupplierId(dbUser) === supplier.id) {
      res.status(400).json({
        error: "You cannot send an RFQ to your own shop. Post an open RFQ or pick another supplier.",
      });
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
    // Do NOT auto-assign supplierId from the product — that made every product RFQ
    // "directed" to one shop and invisible to all other sellers. Explicit supplierId
    // from the client (supplier profile page) still creates a directed RFQ.
    if (categoryId == null && product.category) {
      categoryId = product.category.id;
      categoryName = product.category.name;
    }
  }

  if (supplierId != null && parseLinkedSupplierId(dbUser) === supplierId) {
    res.status(400).json({
      error: "You cannot send an RFQ to your own shop. Post an open RFQ or pick another supplier.",
    });
    return;
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
      openMarketplace: supplierId == null,
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

  const gate = await assertSellerVerifiedToQuote(linkedSupplierId, isAdmin(dbUser));
  if (!gate.ok) {
    res.status(gate.status).json({ error: gate.error });
    return;
  }

  const body = req.body as Record<string, unknown>;
  try {
    const updated = await submitSellerQuote({
      rfqId,
      supplierId: linkedSupplierId,
      supplierName: gate.companyName,
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

/** Buyer accepts a quote → waiting for seller to confirm (deal not closed yet). */
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
  if (dbUser.role === "seller") {
    res.status(403).json({
      error: "Switch to buyer mode to accept quotes.",
    });
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
    // Lead stays "quoted" until seller confirms the deal.
    res.json(GetRfqResponse.parse(formatForViewer(updated, dbUser)));
  } catch (err) {
    res.status(httpErrorStatus(err)).json({
      error: err instanceof Error ? err.message : "Failed to accept quote",
    });
  }
});

/** Selected seller confirms buyer's acceptance → deal closed. */
router.post("/rfq/:id/confirm", requireClerkAuth, async (req, res): Promise<void> => {
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
  const linkedSupplierId = parseLinkedSupplierId(dbUser);
  if (linkedSupplierId == null || (dbUser.role !== "seller" && !isAdmin(dbUser))) {
    res.status(403).json({ error: "Switch to seller mode with a linked shop to confirm." });
    return;
  }

  try {
    const updated = await confirmRfqDeal({ rfqId, supplierId: linkedSupplierId });
    try {
      await syncLeadAfterDeal(updated);
    } catch (err) {
      console.warn("Lead sync after confirm failed", err);
    }
    res.json(GetRfqResponse.parse(formatForViewer(updated, dbUser)));
  } catch (err) {
    res.status(httpErrorStatus(err)).json({
      error: err instanceof Error ? err.message : "Failed to confirm deal",
    });
  }
});

/** Seller declines — or buyer withdraws — a pending mutual confirmation. */
router.post("/rfq/:id/decline-confirm", requireClerkAuth, async (req, res): Promise<void> => {
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

  const linkedSupplierId = parseLinkedSupplierId(dbUser);
  const existing = await loadRfqWithQuotes(rfqId);
  if (!existing) {
    res.status(404).json({ error: "RFQ not found" });
    return;
  }

  try {
    let updated;
    if (existing.buyerId === dbUser.id && dbUser.role !== "seller") {
      updated = await declinePendingRfqConfirm({
        rfqId,
        actor: { type: "buyer", buyerId: dbUser.id },
      });
    } else if (linkedSupplierId != null && (dbUser.role === "seller" || isAdmin(dbUser))) {
      updated = await declinePendingRfqConfirm({
        rfqId,
        actor: { type: "seller", supplierId: linkedSupplierId },
      });
    } else {
      res.status(403).json({ error: "Not allowed to decline this confirmation" });
      return;
    }
    res.json(GetRfqResponse.parse(formatForViewer(updated, dbUser)));
  } catch (err) {
    res.status(httpErrorStatus(err)).json({
      error: err instanceof Error ? err.message : "Failed to decline confirmation",
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
      res.json(UpdateRfqResponse.parse(formatForViewer(updated, dbUser)));
    } catch (err) {
      res.status(httpErrorStatus(err)).json({
        error: err instanceof Error ? err.message : "Failed to accept quote",
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
    const gate = await assertSellerVerifiedToQuote(linkedSupplierId, admin);
    if (!gate.ok) {
      res.status(gate.status).json({ error: gate.error });
      return;
    }
    try {
      const updated = await submitSellerQuote({
        rfqId: existing.id,
        supplierId: linkedSupplierId,
        supplierName: gate.companyName,
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
      if (body.status === "pending_confirm") {
        res.status(400).json({
          error: "Use POST /rfq/:id/award to start seller confirmation — do not set pending_confirm directly",
        });
        return;
      }
      if (
        isRfqAwaitingSellerConfirm(existing.status) &&
        (body.status === "pending" || body.status === "responded")
      ) {
        res.status(400).json({
          error: "Use POST /rfq/:id/decline-confirm to reopen a pending handshake",
        });
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
