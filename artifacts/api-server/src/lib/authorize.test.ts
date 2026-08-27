import { describe, expect, it } from "vitest";
import type { DbUser } from "./authorize";
import {
  canAccessSupplier,
  isAdmin,
  isRfqSupplierParty,
  isSellerOrAdmin,
  parseLinkedSupplierId,
} from "./authorize";

function user(overrides: Partial<DbUser> = {}): DbUser {
  return {
    id: 1,
    clerkId: "clerk_1",
    name: "Test",
    email: "test@example.com",
    password: null,
    role: "buyer",
    company: null,
    avatarUrl: null,
    supplierId: null,
    onboardingCompleted: true,
    buyerEnabled: true,
    sellerEnabled: false,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("parseLinkedSupplierId", () => {
  it("returns null when unset or non-positive", () => {
    expect(parseLinkedSupplierId(user())).toBeNull();
    expect(parseLinkedSupplierId(user({ supplierId: 0 }))).toBeNull();
    expect(parseLinkedSupplierId(user({ supplierId: -1 }))).toBeNull();
  });

  it("returns the linked integer supplier id", () => {
    expect(parseLinkedSupplierId(user({ supplierId: 7 }))).toBe(7);
  });
});

describe("canAccessSupplier", () => {
  it("allows admins for any positive supplier id", () => {
    expect(canAccessSupplier(user({ role: "admin" }), 42)).toBe(true);
    expect(canAccessSupplier(user({ role: "admin" }), 0)).toBe(false);
  });

  it("allows sellers only for their linked shop", () => {
    const seller = user({ role: "seller", supplierId: 3 });
    expect(canAccessSupplier(seller, 3)).toBe(true);
    expect(canAccessSupplier(seller, 9)).toBe(false);
  });

  it("denies buyers even with a supplierId set", () => {
    expect(canAccessSupplier(user({ role: "buyer", supplierId: 3 }), 3)).toBe(false);
  });
});

describe("isRfqSupplierParty", () => {
  it("never treats open RFQs (null supplier) as owned by a seller", () => {
    const seller = user({ role: "seller", supplierId: 3 });
    expect(isRfqSupplierParty(seller, null)).toBe(false);
    expect(isRfqSupplierParty(seller, undefined)).toBe(false);
  });

  it("matches assigned supplier only", () => {
    const seller = user({ role: "seller", supplierId: 3 });
    expect(isRfqSupplierParty(seller, 3)).toBe(true);
    expect(isRfqSupplierParty(seller, 4)).toBe(false);
  });
});

describe("role helpers", () => {
  it("detects admin and seller-or-admin", () => {
    expect(isAdmin(user({ role: "admin" }))).toBe(true);
    expect(isAdmin(user({ role: "seller" }))).toBe(false);
    expect(isSellerOrAdmin(user({ role: "seller" }))).toBe(true);
    expect(isSellerOrAdmin(user({ role: "buyer" }))).toBe(false);
  });
});
