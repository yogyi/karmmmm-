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
    buyerEnabled: true,
    sellerEnabled: false,
    buyerCountry: null,
    buyerCompanyEmail: null,
    buyerCompanyEmailVerified: false,
    buyerCompanyEmailOtpHash: null,
    buyerCompanyEmailOtpExpiresAt: null,
    buyerWhatsapp: null,
    buyerWhatsappVerified: false,
    buyerWhatsappOtpHash: null,
    buyerWhatsappOtpExpiresAt: null,
    buyerRegistrationNumber: null,
    buyerWebsite: null,
    buyerKycCompleted: true,
    buyerKycCompletedAt: null,
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

  it("shows buyer display name to sellers browsing open marketplace RFQs", () => {
    const openRfq = {
      ...rfq,
      supplierId: null as number | null,
      status: "pending",
      buyerName: "Satyarth Traders",
    };
    const out = redactRfqForViewer(
      openRfq,
      user({ id: 2, role: "seller", supplierId: 5 }),
    );
    expect(out.buyerName).toBe("Satyarth Traders");
    expect(out.buyerEmail).toBe("");
    expect(out.targetPrice).toBeNull();
    expect(out.description).toBeNull();
  });

  it("shows full buyer contact to winning seller when deal is closed", () => {
    const closedRfq = {
      ...rfq,
      supplierId: 5,
      status: "accepted",
      buyerName: "Satyarth Traders",
      buyerEmail: "buyer@example.com",
      targetPrice: 80,
      description: "Need 500 units",
      quotes: [{ supplierId: 5, status: "awarded", unitPrice: 99, message: "Done" }],
    };
    const out = redactRfqForViewer(
      closedRfq,
      user({ id: 2, role: "seller", supplierId: 5 }),
    );
    expect(out.buyerEmail).toBe("buyer@example.com");
    expect(out.targetPrice).toBe(80);
    expect(out.description).toBe("Need 500 units");
  });

  it("hides buyer email from losing seller after deal closes", () => {
    const closedRfq = {
      ...rfq,
      supplierId: 99,
      status: "accepted",
      buyerName: "Satyarth Traders",
      buyerEmail: "buyer@example.com",
      quotes: [{ supplierId: 5, status: "declined", unitPrice: 99, message: "Lost" }],
    };
    const out = redactRfqForViewer(
      closedRfq,
      user({ id: 2, role: "seller", supplierId: 5 }),
    );
    expect(out.buyerName).toBe("Satyarth Traders");
    expect(out.buyerEmail).toBe("");
    expect(out.targetPrice).toBeNull();
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
