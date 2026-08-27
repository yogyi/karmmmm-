import { prisma } from "@workspace/db";

const DRAFT_GST_CLEAR = {
  gstin: null,
  pan: null,
  gstLiveStatus: null,
  gstLiveVerifiedAt: null,
  gstTradeName: null,
  gstVerified: false,
  verified: false,
  verifiedAt: null,
  gstCertificateDocumentUrl: null,
  gstCertificateOcrVerifiedAt: null,
  gstCertificateOcrGstin: null,
  gstCertificateOcrLegalName: null,
  gstCertificateOcrRaw: null,
} as const;

/**
 * Ensure `gstin` is free for `supplierId`.
 * Abandoned draft seller profiles that already claimed the GSTIN are cleared
 * so a submitted seller can complete live GSTN verify.
 *
 * Runs in a transaction so concurrent reclaim/verify races are serialized.
 */
export async function ensureGstinAvailableForSupplier(
  gstin: string,
  supplierId: number,
): Promise<{ ok: true } | { ok: false; companyName: string }> {
  return prisma.$transaction(async (tx) => {
    const clash = await tx.supplier.findFirst({
      where: { gstin, NOT: { id: supplierId } },
      select: {
        id: true,
        companyName: true,
        verificationStatus: true,
      },
    });
    if (!clash) return { ok: true };

    if (clash.verificationStatus === "draft") {
      await tx.supplier.update({
        where: { id: clash.id },
        data: DRAFT_GST_CLEAR,
      });
      return { ok: true };
    }

    return { ok: false, companyName: clash.companyName };
  });
}

export function gstinClashError(companyName: string): string {
  return `This GSTIN is already registered to another seller (${companyName}). Sign in with that seller account, or use a different GSTIN.`;
}

/** True when Prisma rejected a unique GSTIN write (concurrent claim). */
export function isGstinUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as {
    code?: unknown;
    name?: unknown;
    message?: unknown;
    meta?: { target?: unknown };
  };
  const isP2002 =
    e.code === "P2002" ||
    e.name === "PrismaClientKnownRequestError" ||
    (typeof e.message === "string" && /unique constraint/i.test(e.message));
  if (!isP2002) return false;
  if (Array.isArray(e.meta?.target)) {
    return (e.meta.target as unknown[]).some((t) => /gstin/i.test(String(t)));
  }
  return /gstin/i.test(String(e.meta?.target ?? e.message ?? ""));
}
