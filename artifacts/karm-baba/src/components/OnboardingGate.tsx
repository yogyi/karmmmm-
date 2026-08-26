import { useContext, useEffect } from "react";
import { useLocation } from "wouter";
import { AuthContext } from "@/context/AuthContext";
import { rememberAuthRedirect } from "@/lib/authRedirect";

const AUTH_PAGES = ["/onboarding", "/login", "/register", "/seller/verify"];

/** Buyer-only surfaces — sellers in seller mode are redirected to Seller Central. */
const BUYER_MARKETPLACE_PATHS = [
  "/",
  "/products",
  "/suppliers",
  "/shortlist",
  "/buyer",
  "/rfq/new",
];

function isBuyerMarketplacePath(location: string): boolean {
  const path = location.split("?")[0] || "/";
  if (BUYER_MARKETPLACE_PATHS.includes(path)) return true;
  if (path.startsWith("/products/")) return true;
  if (path.startsWith("/suppliers/")) return true;
  return false;
}

/**
 * Incomplete onboarding → /onboarding.
 * Active sellers are kept on seller ops pages (no marketplace / buyer browse).
 * Buyers keep marketplace + buyer central.
 */
export function OnboardingGate() {
  // Soft-read so Vite HMR cannot crash the app if this module remounts against a
  // refreshed AuthContext while AuthProvider still holds the previous context object.
  const auth = useContext(AuthContext);
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (!auth) return;
    const { isLoggedIn, isLoaded, profileReady, user } = auth;
    if (!isLoaded || !profileReady || !isLoggedIn || !user) return;
    if (user.id <= 0) return;
    if (user.role === "admin") return;
    if (AUTH_PAGES.some((p) => location === p || location.startsWith(`${p}?`))) return;

    if (!user.onboardingCompleted) {
      rememberAuthRedirect(location);
      navigate("/onboarding");
      return;
    }

    if (user.role === "seller" && isBuyerMarketplacePath(location)) {
      navigate("/seller");
    }
  }, [auth, location, navigate]);

  return null;
}
