import { describe, expect, it } from "vitest";
import type { DbUser } from "./authorize";
import { redactRfqForViewer } from "./redact";

function user(overrides: Partial<DbUser> = {}): DbUser {
  return {
    id: 10,
    clerkId: "clerk_10",
    name: "Viewer",
    email: "viewer@example.com",
    password: null,
    role: "buyer",
    company: null,
    avatarUrl: null,
    supplierId: null,
    onboardingCompleted: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

const rfq = {
  buyerId: 10,
  supplierId: 3,
  buyerEmail: "buyer@example.com",
  buyerName: "Buyer Co",
  quotedPrice: 99,
  sellerMessage: "We can do 99",
  targetPrice: 80,
  description: "Need 500 units",
};

describe("redactRfqForViewer", () => {
  it("strips PII for anonymous viewers", () => {
    const out = redactRfqForViewer(rfq, null);
    expect(out.buyerEmail).toBe("");
    expect(out.buyerName).toBe("Buyer");
    expect(out.quotedPrice).toBeNull();
    expect(out.sellerMessage).toBeNull();
    expect(out.description).toBeNull();
  });

  it("keeps details for the buyer, linked seller, and admin", () => {
    expect(redactRfqForViewer(rfq, user({ id: 10 })).buyerEmail).toBe(
      "buyer@example.com",
    );
    expect(
      redactRfqForViewer(rfq, user({ id: 2, role: "seller", supplierId: 3 }))
        .sellerMessage,
    ).toBe("We can do 99");
    expect(
      redactRfqForViewer(rfq, user({ id: 99, role: "admin" })).buyerEmail,
    ).toBe("buyer@example.com");
  });

  it("redacts commercial fields for unrelated authenticated users", () => {
    const out = redactRfqForViewer(
      rfq,
      user({ id: 99, role: "buyer", supplierId: null }),
    );
    expect(out.buyerEmail).toBe("");
    expect(out.quotedPrice).toBeNull();
    expect(out.sellerMessage).toBeNull();
  });
});
