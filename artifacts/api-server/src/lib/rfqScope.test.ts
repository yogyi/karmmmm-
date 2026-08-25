import { describe, expect, it } from "vitest";
import {
  sellerInboxWhere,
  sellerOpenMarketplaceWhere,
  sortRfqsForSellerInbox,
} from "./rfqScope";

describe("sellerInboxWhere", () => {
  it("includes assigned RFQs, open collecting RFQs, and quoted RFQs", () => {
    expect(sellerInboxWhere(7)).toEqual({
      OR: [
        { supplierId: 7 },
        { supplierId: null, status: { in: ["pending", "responded"] } },
        { quotes: { some: { supplierId: 7 } } },
      ],
    });
  });

  it("applies status filter across inbox branches", () => {
    expect(sellerInboxWhere(7, "responded")).toEqual({
      OR: [
        { supplierId: 7, status: "responded" },
        { supplierId: null, status: "responded" },
        { status: "responded", quotes: { some: { supplierId: 7 } } },
      ],
    });
  });
});

describe("sellerOpenMarketplaceWhere", () => {
  it("lets sellers without a shop still see open collecting RFQs", () => {
    expect(sellerOpenMarketplaceWhere(42)).toEqual({
      OR: [
        { buyerId: 42 },
        { supplierId: null, status: { in: ["pending", "responded"] } },
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
