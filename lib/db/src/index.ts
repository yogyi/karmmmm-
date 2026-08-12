import { PrismaClient, type Prisma } from "@prisma/client";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/** @deprecated Prefer `prisma` — kept as `db` alias during the Drizzle → Prisma migration. */
export const db = prisma;

export type { Prisma };
export { PrismaClient };

/** Convert Prisma Decimal / string numerics to JS number (API responses use floats). */
export function toNumber(value: { toString(): string } | string | number | null | undefined): number | null {
  if (value == null) return null;
  return typeof value === "number" ? value : parseFloat(value.toString());
}
