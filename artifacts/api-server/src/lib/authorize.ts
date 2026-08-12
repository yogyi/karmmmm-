import type { Request } from "express";
import { prisma, type Prisma } from "@workspace/db";
import { getClerkUserId } from "./auth";

export type DbUser = Prisma.UserGetPayload<object>;
export type UserRole = "buyer" | "seller" | "admin";

/** Resolve the authenticated Clerk session to our Postgres user row. */
export async function getAuthenticatedDbUser(req: Request): Promise<DbUser | null> {
  const clerkId = await getClerkUserId(req);
  if (!clerkId) return null;
  return prisma.user.findUnique({ where: { clerkId } });
}

export function parseLinkedSupplierId(user: DbUser): number | null {
  if (user.supplierId == null || user.supplierId <= 0) return null;
  return user.supplierId;
}

export function isAdmin(user: DbUser): boolean {
  return user.role === "admin";
}

export function isSellerOrAdmin(user: DbUser): boolean {
  return user.role === "seller" || user.role === "admin";
}

/** True if the user may act as this supplier (linked shop or admin). */
export function canAccessSupplier(user: DbUser, supplierId: number): boolean {
  if (!Number.isFinite(supplierId) || supplierId <= 0) return false;
  if (isAdmin(user)) return true;
  if (user.role !== "seller") return false;
  return parseLinkedSupplierId(user) === supplierId;
}

/**
 * Seller party for an RFQ. Open RFQs (null supplierId) have no seller party —
 * never treat "missing supplier" as "any seller".
 */
export function isRfqSupplierParty(
  user: DbUser,
  rfqSupplierId: number | null | undefined,
): boolean {
  if (rfqSupplierId == null) return false;
  return canAccessSupplier(user, rfqSupplierId);
}

/** Require one of the given roles; returns an error message or null if allowed. */
export function denyUnlessRole(user: DbUser, roles: UserRole[]): string | null {
  if (roles.includes(user.role as UserRole)) return null;
  return `Forbidden — requires role: ${roles.join(" or ")}`;
}
