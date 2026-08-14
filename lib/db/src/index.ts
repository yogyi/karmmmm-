import { PrismaClient, type Prisma } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function getPrisma(): PrismaClient {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });
  }
  return globalForPrisma.prisma;
}

/** Lazy so `/api/healthz` can boot even if the query engine is still loading. */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrisma();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

/** @deprecated Prefer `prisma` — kept as `db` alias during the Drizzle → Prisma migration. */
export const db = prisma;

export type { Prisma };
export { PrismaClient };

/** Convert Prisma Decimal / string numerics to JS number (API responses use floats). */
export function toNumber(value: { toString(): string } | string | number | null | undefined): number | null {
  if (value == null) return null;
  return typeof value === "number" ? value : parseFloat(value.toString());
}
