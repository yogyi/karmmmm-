import type { AuthUser } from "@/context/AuthContext";
import { isIndiaCountry } from "@/lib/country";

const STORAGE_KEY = "kb:buyer-kyc-resume";

export type BuyerKycResumePhase = "overseas-otp" | "overseas-profile";

export type BuyerKycResumeSnapshot = {
  flow: "overseas";
  phase: BuyerKycResumePhase;
  email?: string;
  whatsapp?: string;
  country?: string;
  registrationNumber?: string;
  website?: string;
  updatedAt: number;
};

export function readBuyerKycResume(): BuyerKycResumeSnapshot | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BuyerKycResumeSnapshot;
    if (parsed?.flow !== "overseas") return null;
    if (parsed.phase !== "overseas-otp" && parsed.phase !== "overseas-profile") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeBuyerKycResume(
  patch: Partial<Omit<BuyerKycResumeSnapshot, "flow" | "updatedAt">> &
    Pick<BuyerKycResumeSnapshot, "phase">,
): void {
  if (typeof sessionStorage === "undefined") return;
  const prev = readBuyerKycResume();
  const next: BuyerKycResumeSnapshot = {
    flow: "overseas",
    phase: patch.phase,
    email: patch.email ?? prev?.email,
    whatsapp: patch.whatsapp ?? prev?.whatsapp,
    country: patch.country ?? prev?.country,
    registrationNumber: patch.registrationNumber ?? prev?.registrationNumber,
    website: patch.website ?? prev?.website,
    updatedAt: Date.now(),
  };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function clearBuyerKycResume(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}

/** Infer overseas verify step from saved profile fields. */
export function overseasPhaseFromUser(
  user: Pick<
    AuthUser,
    | "buyerCountry"
    | "buyerCompanyEmailVerified"
    | "buyerWhatsappVerified"
    | "buyerCompanyEmail"
    | "buyerWhatsapp"
  >,
): BuyerKycResumePhase | null {
  const hasOverseasCountry =
    !!user.buyerCountry && !isIndiaCountry(user.buyerCountry);
  const startedOverseas =
    hasOverseasCountry ||
    !!user.buyerCompanyEmail ||
    !!user.buyerWhatsapp ||
    user.buyerCompanyEmailVerified ||
    user.buyerWhatsappVerified;

  if (!startedOverseas) return null;
  if (user.buyerCompanyEmailVerified && user.buyerWhatsappVerified) {
    return "overseas-profile";
  }
  return "overseas-otp";
}

export function resumeStepLabel(phase: BuyerKycResumePhase): string {
  return phase === "overseas-profile"
    ? "Finish your company details (step 2 of 2)."
    : "Continue email and WhatsApp verification (step 1 of 2).";
}
