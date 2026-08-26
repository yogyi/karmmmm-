import { describe, expect, it } from "vitest";
import {
  sellerInboxWhere,
  sellerOpenMarketplaceWhere,
  sortRfqsForSellerInbox,
} from "./rfqScope";

const marketplaceStatuses = ["pending", "responded", "pending_confirm", "accepted"] as const;

describe("sellerInboxWhere", () => {
  it("includes assigned RFQs, open marketplace RFQs, and quoted RFQs", () => {
    expect(sellerInboxWhere(7)).toEqual({
      OR: [
        { supplierId: 7 },
        {
          OR: [
            { openMarketplace: true, status: { in: [...marketplaceStatuses] } },
            { supplierId: null, status: { in: [...marketplaceStatuses] } },
          ],
        },
        { quotes: { some: { supplierId: 7 } } },
      ],
    });
  });

  it("excludes the viewer's own buyer RFQs when viewerUserId is set", () => {
    expect(sellerInboxWhere(7, undefined, 42)).toEqual({
      AND: [
        { NOT: { buyerId: 42 } },
        {
          OR: [
            { supplierId: 7 },
            {
              OR: [
                { openMarketplace: true, status: { in: [...marketplaceStatuses] } },
                { supplierId: null, status: { in: [...marketplaceStatuses] } },
              ],
            },
            { quotes: { some: { supplierId: 7 } } },
          ],
        },
      ],
    });
  });

  it("applies status filter for assigned, open marketplace, and quoted RFQs", () => {
    expect(sellerInboxWhere(7, "responded", 42)).toEqual({
      AND: [
        { NOT: { buyerId: 42 } },
        {
          OR: [
            { supplierId: 7, status: "responded" },
            { openMarketplace: true, status: "responded" },
            { supplierId: null, status: "responded", quotes: { some: { supplierId: 7 } } },
            { status: "responded", quotes: { some: { supplierId: 7 } } },
          ],
        },
      ],
    });
  });
});

describe("sellerOpenMarketplaceWhere", () => {
  it("returns open marketplace RFQs including closed ones", () => {
    expect(sellerOpenMarketplaceWhere()).toEqual({
      OR: [
        { openMarketplace: true, status: { in: [...marketplaceStatuses] } },
        { supplierId: null, status: { in: [...marketplaceStatuses] } },
      ],
    });
  });
});

describe("sortRfqsForSellerInbox", () => {
  it("puts higher target prices first and nulls last", () => {
    const sorted = sortRfqsForSellerInbox([
      { id: 1, targetPrice: 10, createdAt: "2026-01-02T00:00:00Z" },
      { id: 2, targetPrice: null, createdAt: "2026-01-03T00:00:00Z" },
      { id: 3, targetPrice: 50, createdAt: "2026-01-01T00:00:00Z" },
    ]);
    expect(sorted.map((r) => r.id)).toEqual([3, 1, 2]);
  });
});
