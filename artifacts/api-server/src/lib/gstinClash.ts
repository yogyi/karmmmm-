import { prisma } from "@workspace/db";

const DRAFT_GST_CLEAR = {
  gstin: null,
  pan: null,
  gstLiveStatus: null,
  gstLiveVerifiedAt: null,
  gstTradeName: null,
  gstVerified: false,
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
 */
export async function ensureGstinAvailableForSupplier(
  gstin: string,
  supplierId: number,
): Promise<{ ok: true } | { ok: false; companyName: string }> {
  const clash = await prisma.supplier.findFirst({
    where: { gstin, NOT: { id: supplierId } },
    select: {
      id: true,
      companyName: true,
      verificationStatus: true,
    },
  });
  if (!clash) return { ok: true };

  if (clash.verificationStatus === "draft") {
    await prisma.supplier.update({
      where: { id: clash.id },
      data: DRAFT_GST_CLEAR,
    });
    return { ok: true };
  }

  return { ok: false, companyName: clash.companyName };
}

export function gstinClashError(companyName: string): string {
  return `This GSTIN is already registered to another seller (${companyName}). Sign in with that seller account, or use a different GSTIN.`;
}
