import type { AuthUser } from "@/context/AuthContext";

const INDIA_BUYER_KEY = "kb:buyer-india-activated";

/** India one-tap: remembered for this browser until the API marks KYC complete. */
export function markIndiaBuyerActivated(userId: number): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(INDIA_BUYER_KEY, String(userId));
}

export function clearIndiaBuyerActivated(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(INDIA_BUYER_KEY);
}

export function isIndiaBuyerActivated(userId: number | undefined): boolean {
  if (!userId || typeof sessionStorage === "undefined") return false;
  return sessionStorage.getItem(INDIA_BUYER_KEY) === String(userId);
}

/** Buyers must finish the ~2 min verify (India one-tap or overseas OTP) before sourcing. */
export function needsBuyerKyc(
  user: Pick<AuthUser, "id" | "role" | "buyerKycCompleted"> | null | undefined,
): boolean {
  if (!user) return false;
  if (user.role === "admin") return false;
  if (user.role !== "buyer") return false;
  if (user.buyerKycCompleted === true) return false;
  if (isIndiaBuyerActivated(user.id)) return false;
  return true;
}

export function buyerHomePath(user: AuthUser | null | undefined): string {
  if (needsBuyerKyc(user)) return "/buyer/verify";
  return "/buyer";
}
