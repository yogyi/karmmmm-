import { Router, type IRouter } from "express";
import { prisma, toNumber, type Prisma } from "@workspace/db";
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
import { sellerInboxWhere } from "../lib/rfqScope";

const router: IRouter = Router();

function formatRfq(r: Prisma.RfqGetPayload<object>) {
  return {
    ...r,
    targetPrice: toNumber(r.targetPrice),
    quotedPrice: toNumber(r.quotedPrice),
    sellerMessage: r.sellerMessage ?? null,
    quotedAt: r.quotedAt ? r.quotedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  };
}

function formatRfqForViewer(
  r: Prisma.RfqGetPayload<object>,
  viewer: NonNullable<Awaited<ReturnType<typeof getAuthenticatedDbUser>>>,
) {
  return redactRfqForViewer(formatRfq(r), viewer);
}

function canViewRfq(user: NonNullable<Awaited<ReturnType<typeof getAuthenticatedDbUser>>>, rfq: {
  buyerId: number | null;
  supplierId: number | null;
}): boolean {
  if (isAdmin(user)) return true;
  if (rfq.buyerId != null && rfq.buyerId === user.id) return true;
  if (isRfqSupplierParty(user, rfq.supplierId)) return true;
  // Sellers with a linked shop can open marketplace (unassigned) RFQs to quote them.
  if (
    rfq.supplierId == null &&
    parseLinkedSupplierId(user) != null &&
    (user.role === "seller" || user.role === "admin")
  ) {
    return true;
  }
  return false;
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

  if (isAdmin(dbUser)) {
    if (buyerId != null) where.buyerId = buyerId;
    if (supplierId != null) where.supplierId = supplierId;
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
      // Explicit "my requests" filter
      where.buyerId = dbUser.id;
    } else if (supplierId != null && linkedSupplierId === supplierId) {
      Object.assign(where, sellerInboxWhere(linkedSupplierId, status));
      delete where.status;
    } else if (linkedSupplierId != null && (dbUser.role === "seller" || dbUser.role === "admin")) {
      // Default seller view: own buyer RFQs + assigned + open pending
      where.OR = [
        { buyerId: dbUser.id },
        { supplierId: linkedSupplierId },
        { supplierId: null, status: "pending" },
      ];
      if (status != null) {
        delete where.status;
        where.OR = [
          { buyerId: dbUser.id, status },
          { supplierId: linkedSupplierId, status },
          { supplierId: null, status },
        ];
      }
    } else {
      // Buyer (or seller without a linked shop): only own RFQs
      where.buyerId = dbUser.id;
    }
  }

  const items = await prisma.rfq.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
  res.json(ListRfqsResponse.parse(items.map((r) => formatRfqForViewer(r, dbUser))));
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
  if (input.productId != null) {
    const product = await prisma.product.findUnique({
      where: { id: input.productId },
      select: { id: true, supplierId: true, name: true },
    });
    if (!product) {
      res.status(400).json({ error: "Product not found" });
      return;
    }
    productId = product.id;
    // Prefer product's shop when client didn't attach a supplier
    if (supplierId == null && product.supplierId != null) {
      supplierId = product.supplierId;
      const supplier = await prisma.supplier.findUnique({
        where: { id: product.supplierId },
        select: { companyName: true },
      });
      supplierName = supplier?.companyName ?? null;
    }
  }

  const quantity = Math.floor(Number(input.quantity));
  if (!Number.isFinite(quantity) || quantity < 1) {
    res.status(400).json({ error: "Quantity must be at least 1" });
    return;
  }

  // Never trust client-supplied buyer identity — bind to the authenticated user.
  const rfq = await prisma.rfq.create({
    data: {
      productId,
      productName: input.productName.trim(),
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
  });

  try {
    const { upsertLeadFromRfq } = await import("./leads");
    await upsertLeadFromRfq(rfq.id);
  } catch (err) {
    console.warn("Failed to create CRM lead from RFQ", err);
  }

  res.status(201).json(GetRfqResponse.parse(formatRfqForViewer(rfq, dbUser)));
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

  const rfq = await prisma.rfq.findUnique({ where: { id: params.data.id } });
  if (!rfq) {
    res.status(404).json({ error: "RFQ not found" });
    return;
  }
  if (!canViewRfq(dbUser, rfq)) {
    res.status(403).json({ error: "Forbidden — you cannot view this RFQ" });
    return;
  }

  res.json(GetRfqResponse.parse(formatRfqForViewer(rfq, dbUser)));
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

  const existing = await prisma.rfq.findUnique({ where: { id: params.data.id } });
  if (!existing) {
    res.status(404).json({ error: "RFQ not found" });
    return;
  }

  const isBuyer = existing.buyerId === dbUser.id;
  const linkedSupplierId = parseLinkedSupplierId(dbUser);
  // Open RFQs (supplierId null) have no seller party yet — sellers with a shop may claim them.
  const isSupplierParty = isRfqSupplierParty(dbUser, existing.supplierId);
  const canClaimOpen =
    existing.supplierId == null &&
    linkedSupplierId != null &&
    (dbUser.role === "seller" || dbUser.role === "admin");
  const admin = isAdmin(dbUser);

  if (!admin && !isBuyer && !isSupplierParty && !canClaimOpen) {
    res.status(403).json({ error: "Forbidden — you cannot update this RFQ" });
    return;
  }

  const body = parsed.data as {
    status?: "pending" | "responded" | "accepted" | "rejected";
    supplierName?: string;
    sellerMessage?: string;
    quotedPrice?: number;
  };

  const updates: Prisma.RfqUpdateInput = {};

  // Seller quotes / supplier responses
  if (body.quotedPrice != null || body.sellerMessage != null || body.supplierName != null) {
    if (existing.supplierId == null) {
      if (!admin && !canClaimOpen) {
        res.status(403).json({
          error: "Forbidden — this RFQ has no assigned supplier yet",
        });
        return;
      }
      // Claim the open RFQ for this seller's shop so it persists in their inbox.
      if (linkedSupplierId != null) {
        const shop = await prisma.supplier.findUnique({
          where: { id: linkedSupplierId },
          select: { companyName: true },
        });
        const claimData: Prisma.RfqUpdateManyMutationInput = {
          supplierName: shop?.companyName ?? body.supplierName ?? null,
        };
        if (body.sellerMessage != null) claimData.sellerMessage = body.sellerMessage;
        if (body.quotedPrice != null) {
          claimData.quotedPrice = body.quotedPrice;
          claimData.quotedAt = new Date();
          claimData.status = body.status ?? "responded";
        } else if (body.status != null && (admin || body.status === "responded" || body.status === "rejected")) {
          claimData.status = body.status;
        }

        const claimed = await prisma.rfq.updateMany({
          where: { id: params.data.id, supplierId: null },
          data: {
            ...claimData,
            supplierId: linkedSupplierId,
          },
        });
        if (claimed.count === 0) {
          res.status(409).json({
            error: "This RFQ was just claimed by another supplier",
          });
          return;
        }

        const rfq = await prisma.rfq.findUnique({ where: { id: params.data.id } });
        if (!rfq) {
          res.status(404).json({ error: "RFQ not found" });
          return;
        }
        try {
          const { upsertLeadFromRfq } = await import("./leads");
          await upsertLeadFromRfq(rfq.id);
        } catch (err) {
          console.warn("Lead mirror after RFQ claim failed", err);
        }
        res.json(UpdateRfqResponse.parse(formatRfqForViewer(rfq, dbUser)));
        return;
      }
    } else if (!admin && !isSupplierParty) {
      res.status(403).json({ error: "Forbidden — only the assigned supplier can quote this RFQ" });
      return;
    }
    if (body.supplierName != null) {
      updates.supplierName = body.supplierName;
    }
    if (body.sellerMessage != null) updates.sellerMessage = body.sellerMessage;
    if (body.quotedPrice != null) {
      updates.quotedPrice = body.quotedPrice;
      updates.quotedAt = new Date();
      if (body.status == null) updates.status = "responded";
    }
  }

  // Status transitions
  if (body.status != null) {
    if (admin) {
      updates.status = body.status;
    } else if (
      (isSupplierParty || canClaimOpen) &&
      (body.status === "responded" || body.status === "rejected")
    ) {
      if (canClaimOpen && linkedSupplierId != null && existing.supplierId == null) {
        const claimed = await prisma.rfq.updateMany({
          where: { id: params.data.id, supplierId: null },
          data: {
            supplierId: linkedSupplierId,
            status: body.status,
          },
        });
        if (claimed.count === 0) {
          res.status(409).json({
            error: "This RFQ was just claimed by another supplier",
          });
          return;
        }
        const rfq = await prisma.rfq.findUnique({ where: { id: params.data.id } });
        if (!rfq) {
          res.status(404).json({ error: "RFQ not found" });
          return;
        }
        try {
          const { upsertLeadFromRfq } = await import("./leads");
          await upsertLeadFromRfq(rfq.id);
        } catch (err) {
          console.warn("Lead mirror after RFQ claim failed", err);
        }
        res.json(UpdateRfqResponse.parse(formatRfqForViewer(rfq, dbUser)));
        return;
      }
      updates.status = body.status;
    } else if (isBuyer && (body.status === "accepted" || body.status === "rejected")) {
      updates.status = body.status;
    } else {
      res.status(403).json({ error: "Forbidden — invalid status change for your role" });
      return;
    }
  }

  const rfq = await prisma.rfq.update({
    where: { id: params.data.id },
    data: updates,
  });

  // Mirror to CRM after claim / quote
  try {
    const { upsertLeadFromRfq } = await import("./leads");
    await upsertLeadFromRfq(rfq.id);
  } catch (err) {
    console.warn("Failed to sync CRM lead after RFQ update", err);
  }

  res.json(UpdateRfqResponse.parse(formatRfqForViewer(rfq, dbUser)));
});

export default router;
