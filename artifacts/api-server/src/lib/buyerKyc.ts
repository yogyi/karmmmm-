import type { Prisma } from "@workspace/db";
import { isIndiaCountry } from "./country";

export type BuyerKycPublic = {
  buyerCountry: string | null;
  buyerCompanyEmail: string | null;
  buyerCompanyEmailVerified: boolean;
  buyerWhatsapp: string | null;
  buyerWhatsappVerified: boolean;
  buyerRegistrationNumber: string | null;
  buyerWebsite: string | null;
  buyerKycCompleted: boolean;
  buyerKycCompletedAt: string | null;
};

/** Fields safe to expose on User JSON (never OTP hashes). */
export function buyerKycPublicFields(
  user: Prisma.UserGetPayload<object>,
): BuyerKycPublic {
  return {
    buyerCountry: user.buyerCountry ?? null,
    buyerCompanyEmail: user.buyerCompanyEmail ?? null,
    buyerCompanyEmailVerified: user.buyerCompanyEmailVerified === true,
    buyerWhatsapp: user.buyerWhatsapp ?? null,
    buyerWhatsappVerified: user.buyerWhatsappVerified === true,
    buyerRegistrationNumber: user.buyerRegistrationNumber ?? null,
    buyerWebsite: user.buyerWebsite ?? null,
    buyerKycCompleted: user.buyerKycCompleted === true,
    buyerKycCompletedAt: user.buyerKycCompletedAt
      ? user.buyerKycCompletedAt.toISOString()
      : null,
  };
}

export function buyerNeedsKyc(
  user: Pick<
    Prisma.UserGetPayload<object>,
    "role" | "buyerEnabled" | "buyerKycCompleted" | "buyerCountry"
  >,
): boolean {
  if (user.role === "admin") return false;
  // Buyer workspace users who have not finished the light KYC gate.
  if (user.role !== "buyer" && !user.buyerEnabled) return false;
  if (user.buyerKycCompleted === true && user.buyerCountry) return false;
  return true;
}

export function isOverseasBuyerCountry(country: string | null | undefined): boolean {
  return !isIndiaCountry(country);
}
