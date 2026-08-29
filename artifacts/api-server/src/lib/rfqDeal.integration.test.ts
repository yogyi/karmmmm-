import { beforeEach, describe, expect, it, vi } from "vitest";

type RfqRow = {
  id: number;
  buyerId: number;
  supplierId: number | null;
  supplierName: string | null;
  productName: string;
  buyerName: string;
  buyerEmail: string;
  quantity: number;
  unit: string;
  targetPrice: number | null;
  description: string | null;
  status: string;
  quotedPrice: number | null;
  sellerMessage: string | null;
  quotedAt: Date | null;
  awardedQuoteId: number | null;
  closedAt: Date | null;
  openMarketplace: boolean;
  productId: number | null;
  categoryId: number | null;
  categoryName: string | null;
  createdAt: Date;
};

type QuoteRow = {
  id: number;
  rfqId: number;
  supplierId: number;
  supplierName: string;
  unitPrice: number;
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
};

const testStore = vi.hoisted(() => {
  const state = {
    rfqs: new Map<number, RfqRow>(),
    quotes: new Map<number, QuoteRow>(),
    nextQuoteId: 1,
  };

  function reset() {
    state.rfqs.clear();
    state.quotes.clear();
    state.nextQuoteId = 1;
  }

  function seedRfq(overrides: Partial<RfqRow> = {}): RfqRow {
    const id = overrides.id ?? state.rfqs.size + 1;
    const row: RfqRow = {
      id,
      buyerId: 1,
      supplierId: null,
      supplierName: null,
      productName: "Cotton fabric",
      buyerName: "Buyer Co",
      buyerEmail: "buyer@example.com",
      quantity: 100,
      unit: "piece",
      targetPrice: 80,
      description: "Need bulk order",
      status: "pending",
      quotedPrice: null,
      sellerMessage: null,
      quotedAt: null,
      awardedQuoteId: null,
      closedAt: null,
      openMarketplace: true,
      productId: null,
      categoryId: null,
      categoryName: null,
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
      ...overrides,
    };
    state.rfqs.set(id, row);
    return row;
  }

  function matchQuoteWhere(q: QuoteRow, where: Record<string, unknown>): boolean {
    for (const [key, val] of Object.entries(where)) {
      if (key === "status") {
        const spec = val as { in?: string[] } | string;
        if (typeof spec === "string") {
          if (q.status !== spec) return false;
        } else if (spec.in && !spec.in.includes(q.status)) {
          return false;
        }
        continue;
      }
      if (key === "id") {
        const spec = val as { not?: number };
        if (typeof val === "number" && q.id !== val) return false;
        if (spec?.not != null && q.id === spec.not) return false;
        continue;
      }
      if ((q as Record<string, unknown>)[key] !== val) return false;
    }
    return true;
  }

  function makeTx() {
    return {
      $executeRaw: async () => undefined,
      rfq: {
        findUnique: async (args: {
          where: { id: number };
          include?: { quotes?: { orderBy?: { unitPrice: "asc" } } };
        }) => {
          const row = state.rfqs.get(args.where.id);
          if (!row) return null;
          const qs = [...state.quotes.values()]
            .filter((q) => q.rfqId === row.id)
            .sort((a, b) => a.unitPrice - b.unitPrice);
          return { ...row, quotes: qs };
        },
        update: async (args: { where: { id: number }; data: Partial<RfqRow> }) => {
          const row = state.rfqs.get(args.where.id);
          if (!row) throw new Error("RFQ not found");
          const updated = { ...row, ...args.data };
          state.rfqs.set(row.id, updated);
          return updated;
        },
      },
      rfqQuote: {
        findMany: async (args: {
          where: Record<string, unknown>;
          orderBy?: { unitPrice: "asc" };
        }) => {
          let rows = [...state.quotes.values()].filter((q) => matchQuoteWhere(q, args.where));
          if (args.orderBy?.unitPrice === "asc") {
            rows = rows.sort((a, b) => a.unitPrice - b.unitPrice);
          }
          return rows;
        },
        findFirst: async (args: { where: Record<string, unknown> }) =>
          [...state.quotes.values()].find((q) => matchQuoteWhere(q, args.where)) ?? null,
        upsert: async (args: {
          where: { rfqId_supplierId: { rfqId: number; supplierId: number } };
          create: Omit<QuoteRow, "id" | "createdAt" | "updatedAt">;
          update: Partial<QuoteRow>;
        }) => {
          const { rfqId, supplierId } = args.where.rfqId_supplierId;
          const existing = [...state.quotes.values()].find(
            (q) => q.rfqId === rfqId && q.supplierId === supplierId,
          );
          const now = new Date();
          if (existing) {
            const updated = { ...existing, ...args.update, updatedAt: now };
            state.quotes.set(existing.id, updated);
            return updated;
          }
          const id = state.nextQuoteId++;
          const created: QuoteRow = {
            id,
            createdAt: now,
            updatedAt: now,
            ...args.create,
          };
          state.quotes.set(id, created);
          return created;
        },
        update: async (args: { where: { id: number }; data: Partial<QuoteRow> }) => {
          const row = state.quotes.get(args.where.id);
          if (!row) throw new Error("Quote not found");
          const updated = { ...row, ...args.data, updatedAt: new Date() };
          state.quotes.set(row.id, updated);
          return updated;
        },
        updateMany: async (args: { where: Record<string, unknown>; data: Partial<QuoteRow> }) => {
          let count = 0;
          for (const [id, q] of state.quotes) {
            if (!matchQuoteWhere(q, args.where)) continue;
            state.quotes.set(id, { ...q, ...args.data, updatedAt: new Date() });
            count++;
          }
          return { count };
        },
      },
    };
  }

  const prisma = {
    ...makeTx(),
    $transaction: async (fn: (tx: ReturnType<typeof makeTx>) => Promise<unknown>) => fn(makeTx()),
  };

  return { state, reset, seedRfq, prisma };
});

vi.mock("@workspace/db", () => ({
  prisma: testStore.prisma,
  toNumber: (value: { toString(): string } | string | number | null | undefined) => {
    if (value == null) return null;
    return typeof value === "number" ? value : parseFloat(value.toString());
  },
}));

import {
  awardRfqQuote,
  confirmRfqDeal,
  declinePendingRfqConfirm,
  formatRfqDeal,
  submitSellerQuote,
} from "./rfqDeal";

describe("RFQ deal flow integration", () => {
  beforeEach(() => {
    testStore.reset();
  });

  it("quote → award → confirm closes the deal", async () => {
    testStore.seedRfq({ id: 1 });

    await submitSellerQuote({
      rfqId: 1,
      supplierId: 10,
      supplierName: "Shop A",
      input: { unitPrice: 95, quantity: 100, unit: "piece", message: "A offer" },
    });
    const withTwoQuotes = await submitSellerQuote({
      rfqId: 1,
      supplierId: 11,
      supplierName: "Shop B",
      input: { unitPrice: 88, quantity: 100, unit: "piece", message: "B offer" },
    });

    expect(Number(testStore.state.rfqs.get(1)?.quotedPrice)).toBe(88);

    const lowQuoteId = withTwoQuotes.quotes.find((q) => q.supplierId === 11)!.id;
    const awarded = await awardRfqQuote({ rfqId: 1, quoteId: lowQuoteId, buyerId: 1 });
    expect(awarded.status).toBe("pending_confirm");
    expect(awarded.awardedQuoteId).not.toBeNull();

    const confirmed = await confirmRfqDeal({ rfqId: 1, supplierId: 11 });
    expect(confirmed.status).toBe("accepted");
    expect(confirmed.supplierId).toBe(11);
    expect(confirmed.closedAt).not.toBeNull();
    expect(confirmed.quotes.find((q) => q.supplierId === 11)?.status).toBe("awarded");
    expect(confirmed.quotes.find((q) => q.supplierId === 10)?.status).toBe("declined");
  });

  it("quote → award → decline reopens RFQ with lowest active quote summary", async () => {
    testStore.seedRfq({ id: 2 });

    await submitSellerQuote({
      rfqId: 2,
      supplierId: 10,
      supplierName: "Shop A",
      input: { unitPrice: 100, quantity: 50, unit: "piece", message: "High" },
    });
    const withLow = await submitSellerQuote({
      rfqId: 2,
      supplierId: 11,
      supplierName: "Shop B",
      input: { unitPrice: 75, quantity: 50, unit: "piece", message: "Low" },
    });
    const lowQuoteId = withLow.quotes.find((q) => q.supplierId === 11)!.id;

    await awardRfqQuote({ rfqId: 2, quoteId: lowQuoteId, buyerId: 1 });

    const declined = await declinePendingRfqConfirm({
      rfqId: 2,
      actor: { type: "seller", supplierId: 11 },
    });

    expect(declined.status).toBe("responded");
    expect(declined.awardedQuoteId).toBeNull();
    expect(declined.quotes.find((q) => q.supplierId === 11)?.status).toBe("active");
    expect(Number(formatRfqDeal(declined).quotedPrice)).toBe(75);
  });

  it("buyer can withdraw pending_confirm acceptance", async () => {
    testStore.seedRfq({ id: 3 });

    const quoted = await submitSellerQuote({
      rfqId: 3,
      supplierId: 10,
      supplierName: "Shop A",
      input: { unitPrice: 60, quantity: 20, unit: "piece" },
    });
    const quoteId = quoted.quotes[0]!.id;

    await awardRfqQuote({ rfqId: 3, quoteId, buyerId: 1 });

    const withdrawn = await declinePendingRfqConfirm({
      rfqId: 3,
      actor: { type: "buyer", buyerId: 1 },
    });

    expect(withdrawn.status).toBe("responded");
    expect(withdrawn.awardedQuoteId).toBeNull();
    expect(withdrawn.quotes[0]?.status).toBe("active");
  });

  it("uses lowest active quote in list summary when a higher quote arrives later", async () => {
    testStore.seedRfq({ id: 4 });

    await submitSellerQuote({
      rfqId: 4,
      supplierId: 10,
      supplierName: "Shop A",
      input: { unitPrice: 120, quantity: 10, unit: "piece", message: "First high" },
    });
    await submitSellerQuote({
      rfqId: 4,
      supplierId: 11,
      supplierName: "Shop B",
      input: { unitPrice: 90, quantity: 10, unit: "piece", message: "Second low" },
    });
    await submitSellerQuote({
      rfqId: 4,
      supplierId: 12,
      supplierName: "Shop C",
      input: { unitPrice: 110, quantity: 10, unit: "piece", message: "Third mid" },
    });

    const row = testStore.state.rfqs.get(4)!;
    expect(Number(row.quotedPrice)).toBe(90);
    expect(row.sellerMessage).toBe("Second low");
  });
});
