import { Router, type IRouter } from "express";
import { eq, ilike, and, sql } from "drizzle-orm";
import { db, suppliersTable } from "@workspace/db";
import {
  CreateSupplierBody,
  UpdateSupplierBody,
  UpdateSupplierParams,
  GetSupplierParams,
  GetSupplierResponse,
  UpdateSupplierResponse,
  GetFeaturedSuppliersResponse,
  ListSuppliersQueryParams,
} from "@workspace/api-zod";
import { requireClerkAuth } from "../lib/auth";

const router: IRouter = Router();

router.get("/suppliers", async (req, res): Promise<void> => {
  const parsed = ListSuppliersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { search, verified, page = 1, limit = 20 } = parsed.data;

  const conditions = [];
  if (search) conditions.push(ilike(suppliersTable.companyName, `%${search}%`));
  if (verified !== undefined && verified !== null) conditions.push(eq(suppliersTable.verified, verified));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(suppliersTable)
    .where(whereClause);

  const items = await db
    .select()
    .from(suppliersTable)
    .where(whereClause)
    .orderBy(suppliersTable.verified, suppliersTable.rating)
    .limit(limit)
    .offset((page - 1) * limit);

  const mapped = items.map(s => ({
    ...s,
    rating: parseFloat(s.rating ?? "0"),
    responseRate: s.responseRate ? parseFloat(s.responseRate) : null,
    mainProducts: s.mainProducts ?? [],
    certifications: s.certifications ?? [],
    createdAt: s.createdAt.toISOString(),
  }));

  res.json({ items: mapped, total: count, page, limit });
});

router.get("/suppliers/featured", async (_req, res): Promise<void> => {
  const items = await db
    .select()
    .from(suppliersTable)
    .where(eq(suppliersTable.verified, true))
    .orderBy(suppliersTable.rating)
    .limit(8);

  const mapped = items.map(s => ({
    ...s,
    rating: parseFloat(s.rating ?? "0"),
    responseRate: s.responseRate ? parseFloat(s.responseRate) : null,
    mainProducts: s.mainProducts ?? [],
    certifications: s.certifications ?? [],
    createdAt: s.createdAt.toISOString(),
  }));

  res.json(GetFeaturedSuppliersResponse.parse(mapped));
});

router.get("/suppliers/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetSupplierParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [supplier] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, params.data.id));
  if (!supplier) {
    res.status(404).json({ error: "Supplier not found" });
    return;
  }

  res.json(GetSupplierResponse.parse({
    ...supplier,
    rating: parseFloat(supplier.rating ?? "0"),
    responseRate: supplier.responseRate ? parseFloat(supplier.responseRate) : null,
    mainProducts: supplier.mainProducts ?? [],
    certifications: supplier.certifications ?? [],
    createdAt: supplier.createdAt.toISOString(),
  }));
});

router.post("/suppliers", requireClerkAuth, async (req, res): Promise<void> => {
  const parsed = CreateSupplierBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [supplier] = await db.insert(suppliersTable).values({
    ...parsed.data,
    rating: "0",
  }).returning();

  res.status(201).json(GetSupplierResponse.parse({
    ...supplier,
    rating: parseFloat(supplier.rating ?? "0"),
    responseRate: null,
    mainProducts: supplier.mainProducts ?? [],
    certifications: supplier.certifications ?? [],
  }));
});

router.patch("/suppliers/:id", requireClerkAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateSupplierParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateSupplierBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [supplier] = await db
    .update(suppliersTable)
    .set(parsed.data)
    .where(eq(suppliersTable.id, params.data.id))
    .returning();

  if (!supplier) {
    res.status(404).json({ error: "Supplier not found" });
    return;
  }

  res.json(UpdateSupplierResponse.parse({
    ...supplier,
    rating: parseFloat(supplier.rating ?? "0"),
    responseRate: supplier.responseRate ? parseFloat(supplier.responseRate) : null,
    mainProducts: supplier.mainProducts ?? [],
    certifications: supplier.certifications ?? [],
  }));
});

export default router;
