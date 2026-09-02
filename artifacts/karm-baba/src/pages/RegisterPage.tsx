import { useEffect, useRef, useState } from "react";
import { SignUp, useAuth as useClerkAuth } from "@clerk/react";
import { useLocation, useSearch } from "wouter";
import { Loader2 } from "lucide-react";
import { AuthModeToggle } from "@/components/AuthModeToggle";
import {
  type AuthMode,
  getAuthModeFromUrl,
  resolveInitialAuthMode,
  setStoredAuthMode,
} from "@/lib/authMode";
import {
  clearAuthRedirect,
  clerkAuthRedirectUrls,
  rememberAuthRedirect,
} from "@/lib/authRedirect";
import { useAuth } from "@/context/AuthContext";
import { useSwitchAccountRole } from "@/components/SwitchRoleDialog";
import logoUrl from "@assets/logo_1780688383558.png";

function redirectFromSearch(search: string): string | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return params.get("redirect");
}

export function RegisterPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const { isSignedIn, isLoaded: clerkLoaded } = useClerkAuth();
  const { user, isLoaded, profileReady } = useAuth();
  const { switching, hasBuyerAccount, hasSellerAccount } = useSwitchAccountRole();
  const [mode, setMode] = useState<AuthMode>(() => resolveInitialAuthMode("buyer"));
  const [continuing, setContinuing] = useState(false);
  const autoContinued = useRef(false);
  const redirect = redirectFromSearch(search);
  const clerkSearch = (() => {
    const params = new URLSearchParams(
      search.startsWith("?") ? search.slice(1) : search,
    );
    params.set("mode", mode);
    if (mode === "buyer") {
      const r = params.get("redirect");
      if (r && (r === "/seller" || r.startsWith("/seller/") || r.startsWith("/dashboard"))) {
        params.delete("redirect");
      }
    }
    return `?${params.toString()}`;
  })();
  const clerkRedirects = clerkAuthRedirectUrls(clerkSearch);

  useEffect(() => {
    setStoredAuthMode(mode);
  }, [mode]);

  function selectMode(next: AuthMode) {
    setMode(next);
    setStoredAuthMode(next);
    autoContinued.current = false;
    const url = new URL(window.location.href);
    url.searchParams.set("mode", next);
    if (next === "buyer") {
      const r = url.searchParams.get("redirect");
      if (r && (r === "/seller" || r.startsWith("/seller/") || r.startsWith("/dashboard"))) {
        url.searchParams.delete("redirect");
        clearAuthRedirect();
      }
    }
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }

  function continueSignedIn() {
    if (!user || continuing || switching) return;
    setContinuing(true);
    if (redirect && !(mode === "buyer" && (redirect.startsWith("/seller") || redirect.startsWith("/dashboard")))) {
      rememberAuthRedirect(redirect);
    } else if (mode === "buyer") {
      clearAuthRedirect();
    }
    window.location.assign(`/auth/continue?mode=${mode}`);
  }

  const authReady = clerkLoaded && isLoaded && profileReady;
  const alreadySignedIn = Boolean(authReady && isSignedIn && user);

  useEffect(() => {
    if (!alreadySignedIn || autoContinued.current || continuing || switching) return;
    if (!getAuthModeFromUrl()) return;
    autoContinued.current = true;
    continueSignedIn();
  }, [alreadySignedIn, mode, continuing, switching]);

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-2/5 bg-secondary relative overflow-hidden flex-col items-center justify-center hero-pattern px-10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full translate-x-1/3 -translate-y-1/3 blur-3xl" />
        <div className="relative text-white w-full max-w-sm">
          <button type="button" onClick={() => navigate("/")} className="mb-8 block">
            <img src={logoUrl} alt="Karm Baba" className="h-12 brightness-200" />
          </button>
          <h2 className="font-heading text-2xl font-bold mb-2">
            {mode === "seller" ? "Start selling wholesale" : "Join as a buyer — free"}
          </h2>
          <p className="text-white/60 text-sm mb-8 leading-relaxed">
            {mode === "seller"
              ? "Create a seller account to list products, win RFQs, and reach buyers across India."
              : "Create a buyer account to browse verified suppliers, shortlist products, and request quotes."}
          </p>
          <ul className="space-y-3 text-sm text-white/75">
            {mode === "seller" ? (
              <>
                <li>• Publish your catalog</li>
                <li>• Receive and quote RFQs</li>
                <li>• Build a verified supplier profile</li>
              </>
            ) : (
              <>
                <li>• Source from verified manufacturers</li>
                <li>• Compare prices with RFQs</li>
                <li>• Shortlist products and suppliers</li>
              </>
            )}
          </ul>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 kb-page min-w-0">
        <div className="w-full max-w-md min-w-0">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="lg:hidden mb-6 flex items-center gap-2 mx-auto"
          >
            <img src={logoUrl} alt="Karm Baba" className="h-10" />
          </button>

          <div className="mb-2 text-center">
            <h1 className="font-heading text-2xl font-bold text-foreground">Create account</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "seller" ? "Create your seller account" : "Create your buyer account"}
            </p>
          </div>

          <AuthModeToggle mode={mode} onChange={selectMode} />

          {!authReady ? (
            <div className="flex justify-center py-16">
              <Loader2 className="animate-spin text-primary" size={28} />
            </div>
          ) : alreadySignedIn ? (
            <div className="rounded-2xl border border-border bg-white shadow-xl p-6 space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                {mode === "seller" && !hasSellerAccount
                  ? "Create a seller account on this login to list products and quote RFQs."
                  : mode === "buyer" && !hasBuyerAccount
                    ? "Create a buyer account on this login to source suppliers and post RFQs."
                    : "You're already signed in. Choose Buyer or Seller above, then continue."}
              </p>
              <button
                type="button"
                disabled={continuing || switching}
                onClick={() => void continueSignedIn()}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary min-h-11 px-4 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
              >
                {(continuing || switching) && (
                  <Loader2 size={16} className="animate-spin" />
                )}
                {mode === "seller" && !hasSellerAccount
                  ? "Create seller account"
                  : mode === "buyer" && !hasBuyerAccount
                    ? "Create buyer account"
                    : `Continue as ${mode === "seller" ? "Seller" : "Buyer"}`}
              </button>
            </div>
          ) : (
            <SignUp
              key={`kb-sign-up-${mode}`}
              routing="hash"
              signInUrl={`/login?mode=${mode}`}
              fallbackRedirectUrl={clerkRedirects.fallbackRedirectUrl}
              forceRedirectUrl={clerkRedirects.forceRedirectUrl}
              appearance={{
                elements: {
                  rootBox: "mx-auto w-full",
                  card: "shadow-xl border border-border rounded-2xl",
                },
              }}
            />
          )}

          <p className="text-center text-sm text-muted-foreground mt-6">
            Already have an account?{" "}
            <button
              type="button"
              onClick={() =>
                navigate(
                  `/login?mode=${mode}${
                    redirect ? `&redirect=${encodeURIComponent(redirect)}` : ""
                  }`,
                )
              }
              className="text-primary font-semibold hover:underline"
            >
              Sign in as {mode === "seller" ? "Seller" : "Buyer"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
