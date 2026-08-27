import { useEffect, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Loader2 } from "lucide-react";
import { useAuth as useClerkAuth } from "@clerk/react";
import { useAuth } from "@/context/AuthContext";
import {
  type AuthMode,
  clearPendingWorkspace,
  clearStoredAuthMode,
  parseAuthMode,
  setPendingWorkspace,
  setStoredAuthMode,
} from "@/lib/authMode";
import { consumeAuthRedirect, peekAuthRedirect } from "@/lib/authRedirect";
import { applyAccountRole } from "@/components/SwitchRoleDialog";
import { workspaceHomePath } from "@/lib/workspaceHome";

/**
 * Post-Clerk landing. Always applies the Buyer/Seller choice from ?mode=
 * before opening a workspace — avoids dumping existing sellers into /seller
 * when they signed in via /login?mode=buyer.
 */
export function AuthContinuePage() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const { isSignedIn, isLoaded: clerkLoaded, getToken } = useClerkAuth();
  const { user, isLoaded, profileReady, refreshProfile } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  const mode: AuthMode = parseAuthMode(params.get("mode")) ?? "buyer";

  useEffect(() => {
    setStoredAuthMode(mode);
    setPendingWorkspace(mode);
  }, [mode]);

  useEffect(() => {
    if (!clerkLoaded || !isLoaded || !profileReady) return;
    if (!isSignedIn) {
      navigate(`/login?mode=${mode}`);
      return;
    }
    if (!user || user.id <= 0) return;
    if (ran.current) return;
    ran.current = true;

    const current = user;

    async function go() {
      try {
        if (current.role === "admin") {
          clearStoredAuthMode();
          clearPendingWorkspace();
          navigate(consumeAuthRedirect("/"));
          return;
        }

        if (current.role !== mode || !current.onboardingCompleted) {
          await applyAccountRole(mode, getToken, refreshProfile);
        } else {
          clearStoredAuthMode();
        }

        const fallback =
          mode === "seller" ? workspaceHomePath("seller") : workspaceHomePath("buyer");
        const path = consumeAuthRedirect(peekAuthRedirect() ?? fallback);
        // Full navigation so AuthProvider re-syncs with the new role before
        // OnboardingGate / BuyerCentral evaluate seller redirects.
        window.location.replace(path);
      } catch (e) {
        ran.current = false;
        setError(e instanceof Error ? e.message : "Could not open your account");
      }
    }

    void go();
  }, [
    clerkLoaded,
    isLoaded,
    profileReady,
    isSignedIn,
    user,
    mode,
    getToken,
    refreshProfile,
    navigate,
  ]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center kb-page gap-3 px-4">
      {error ? (
        <>
          <p className="text-sm text-red-700 text-center max-w-md">{error}</p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              ran.current = false;
              navigate(`/login?mode=${mode}`);
            }}
            className="text-sm font-semibold text-primary hover:underline"
          >
            Back to sign in
          </button>
        </>
      ) : (
        <>
          <Loader2 className="animate-spin text-primary" size={28} />
          <p className="text-sm text-muted-foreground">
            Opening your {mode === "seller" ? "seller" : "buyer"} account…
          </p>
        </>
      )}
    </div>
  );
}
