import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, rfqTable } from "@workspace/db";
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

const router: IRouter = Router();

function formatRfq(r: typeof rfqTable.$inferSelect) {
  return {
    ...r,
    targetPrice: r.targetPrice ? parseFloat(r.targetPrice) : null,
    quotedPrice: r.quotedPrice ? parseFloat(r.quotedPrice) : null,
    sellerMessage: r.sellerMessage ?? null,
    quotedAt: r.quotedAt ? r.quotedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  };
}

router.get("/rfq", async (req, res): Promise<void> => {
  const parsed = ListRfqsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { buyerId, supplierId, status } = parsed.data;

  const conditions = [];
  if (buyerId != null) conditions.push(eq(rfqTable.buyerId, buyerId));
  if (supplierId != null) conditions.push(eq(rfqTable.supplierId, supplierId));
  if (status != null) conditions.push(eq(rfqTable.status, status));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const items = await db.select().from(rfqTable).where(whereClause).orderBy(rfqTable.createdAt);
  res.json(ListRfqsResponse.parse(items.map(formatRfq)));
});

router.post("/rfq", requireClerkAuth, async (req, res): Promise<void> => {
  const parsed = CreateRfqBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let supplierName = null as string | null;
  if (parsed.data.supplierId) {
    const { suppliersTable } = await import("@workspace/db");
    const [supplier] = await db
      .select({ companyName: suppliersTable.companyName })
      .from(suppliersTable)
      .where(eq(suppliersTable.id, parsed.data.supplierId));
    supplierName = supplier?.companyName ?? null;
  }

  const [rfq] = await db.insert(rfqTable).values({
    ...parsed.data,
    supplierName,
    targetPrice: parsed.data.targetPrice != null ? String(parsed.data.targetPrice) : null,
  }).returning();

  res.status(201).json(GetRfqResponse.parse(formatRfq(rfq)));
});

router.get("/rfq/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetRfqParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [rfq] = await db.select().from(rfqTable).where(eq(rfqTable.id, params.data.id));
  if (!rfq) {
    res.status(404).json({ error: "RFQ not found" });
    return;
  }

  res.json(GetRfqResponse.parse(formatRfq(rfq)));
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

  const updates: Record<string, unknown> = {};
  if (parsed.data.status != null) updates.status = parsed.data.status;
  const body = parsed.data as {
    status?: string;
    supplierName?: string;
    sellerMessage?: string;
    quotedPrice?: number;
  };
  if (body.supplierName != null) updates.supplierName = body.supplierName;
  if (body.sellerMessage != null) updates.sellerMessage = body.sellerMessage;
  if (body.quotedPrice != null) {
    updates.quotedPrice = String(body.quotedPrice);
    updates.quotedAt = new Date();
    if (parsed.data.status == null) updates.status = "responded";
  }

  const [rfq] = await db
    .update(rfqTable)
    .set(updates)
    .where(eq(rfqTable.id, params.data.id))
    .returning();

  if (!rfq) {
    res.status(404).json({ error: "RFQ not found" });
    return;
  }

  res.json(UpdateRfqResponse.parse(formatRfq(rfq)));
});

export default router;
