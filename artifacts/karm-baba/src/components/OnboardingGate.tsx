import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { rememberAuthRedirect } from "@/lib/authRedirect";

const AUTH_PAGES = ["/onboarding", "/login", "/register", "/seller/verify"];

/**
 * Incomplete onboarding → /onboarding.
 * Does NOT force completed users off `/` — marketplace browsing must stay reachable
 * (Seller Central "Marketplace", logo, etc.). Portals are reached via onboarding
 * completion and explicit Buyer/Seller Central links.
 */
export function OnboardingGate() {
  const { isLoggedIn, isLoaded, profileReady, user } = useAuth();
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (!isLoaded || !profileReady || !isLoggedIn || !user) return;
    if (user.id <= 0) return;
    if (user.role === "admin") return;
    if (AUTH_PAGES.some((p) => location === p || location.startsWith(`${p}?`))) return;

    if (!user.onboardingCompleted) {
      rememberAuthRedirect(location);
      navigate("/onboarding");
    }
  }, [isLoaded, profileReady, isLoggedIn, user, location, navigate]);

  return null;
}
