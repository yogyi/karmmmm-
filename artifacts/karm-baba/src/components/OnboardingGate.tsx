import { useContext, useEffect } from "react";
import { useLocation } from "wouter";
import { AuthContext } from "@/context/AuthContext";
import { rememberAuthRedirect } from "@/lib/authRedirect";

const AUTH_PAGES = ["/onboarding", "/login", "/register", "/seller/verify"];

/** Buyer browse surfaces — sellers stay on Seller Central.
 * Product detail (`/products/:id`) is allowed so sellers can preview a listing. */
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
  // Allow /products/:id (seller "View" preview) — block supplier browse only
  if (path.startsWith("/suppliers/")) return true;
  return false;
}

/**
 * Incomplete onboarding → /onboarding.
 * Active sellers are kept off buyer browse (home, product list, suppliers, etc.)
 * but can open a product detail page to preview their listing.
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
