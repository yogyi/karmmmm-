import { describe, expect, it } from "vitest";
import {
  isRfqClosed,
  isRfqOpenForQuotes,
  pickBestQuoteForListSummary,
} from "./rfqDeal";

describe("RFQ deal lifecycle helpers", () => {
  it("treats pending and responded as open for quotes", () => {
    expect(isRfqOpenForQuotes("pending")).toBe(true);
    expect(isRfqOpenForQuotes("responded")).toBe(true);
    expect(isRfqOpenForQuotes("pending_confirm")).toBe(false);
    expect(isRfqOpenForQuotes("accepted")).toBe(false);
    expect(isRfqOpenForQuotes("rejected")).toBe(false);
  });

  it("treats accepted and rejected as closed deals", () => {
    expect(isRfqClosed("accepted")).toBe(true);
    expect(isRfqClosed("rejected")).toBe(true);
    expect(isRfqClosed("pending_confirm")).toBe(false);
    expect(isRfqClosed("pending")).toBe(false);
    expect(isRfqClosed("responded")).toBe(false);
  });
});

describe("pickBestQuoteForListSummary", () => {
  it("picks lowest active quote for open collection", () => {
    const best = pickBestQuoteForListSummary([
      { unitPrice: 120, status: "active", message: "high" },
      { unitPrice: 90, status: "active", message: "low" },
      { unitPrice: 110, status: "active", message: "mid" },
    ]);
    expect(Number(best?.unitPrice)).toBe(90);
    expect(best?.message).toBe("low");
  });

  it("prefers awarded quote over lower active quotes", () => {
    const best = pickBestQuoteForListSummary([
      { unitPrice: 50, status: "active", message: "cheap" },
      { unitPrice: 80, status: "awarded", message: "winner" },
    ]);
    expect(Number(best?.unitPrice)).toBe(80);
    expect(best?.status).toBe("awarded");
  });

  it("ignores withdrawn and declined quotes", () => {
    const best = pickBestQuoteForListSummary([
      { unitPrice: 40, status: "declined", message: "lost" },
      { unitPrice: 95, status: "active", message: "still in" },
    ]);
    expect(Number(best?.unitPrice)).toBe(95);
  });
});
