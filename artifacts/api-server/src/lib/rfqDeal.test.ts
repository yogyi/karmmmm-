import { describe, expect, it } from "vitest";
import { isRfqClosed, isRfqOpenForQuotes } from "./rfqDeal";

describe("RFQ deal lifecycle helpers", () => {
  it("treats pending and responded as open for quotes", () => {
    expect(isRfqOpenForQuotes("pending")).toBe(true);
    expect(isRfqOpenForQuotes("responded")).toBe(true);
    expect(isRfqOpenForQuotes("accepted")).toBe(false);
    expect(isRfqOpenForQuotes("rejected")).toBe(false);
  });

  it("treats accepted and rejected as closed deals", () => {
    expect(isRfqClosed("accepted")).toBe(true);
    expect(isRfqClosed("rejected")).toBe(true);
    expect(isRfqClosed("pending")).toBe(false);
    expect(isRfqClosed("responded")).toBe(false);
  });
});
