import { useEffect, useState } from "react";
import { SignIn, useAuth as useClerkAuth } from "@clerk/react";
import { useLocation, useSearch } from "wouter";
import { Loader2 } from "lucide-react";
import { AuthModeToggle } from "@/components/AuthModeToggle";
import {
  type AuthMode,
  resolveInitialAuthMode,
  setStoredAuthMode,
} from "@/lib/authMode";
import { clerkAuthRedirectUrls, consumeAuthRedirect } from "@/lib/authRedirect";
import { useAuth } from "@/context/AuthContext";
import { useSwitchAccountRole } from "@/components/SwitchRoleDialog";
import { workspaceHomePath } from "@/lib/workspaceHome";
import logoUrl from "@assets/logo_1780688383558.png";

function redirectFromSearch(search: string): string | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return params.get("redirect");
}

export function LoginPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const { isSignedIn, isLoaded: clerkLoaded } = useClerkAuth();
  const { user, isLoaded, profileReady } = useAuth();
  const { switchTo, switching, hasBuyerAccount, hasSellerAccount } = useSwitchAccountRole();
  const [mode, setMode] = useState<AuthMode>(() => resolveInitialAuthMode("buyer"));
  const [continuing, setContinuing] = useState(false);
  const clerkRedirects = clerkAuthRedirectUrls(search);
  const redirect = redirectFromSearch(search);

  useEffect(() => {
    setStoredAuthMode(mode);
  }, [mode]);

  function selectMode(next: AuthMode) {
    // Preference only — never navigate. Remounting Clerk SignIn with a new
    // signUpUrl while a session exists was force-redirecting to /buyer|/seller.
    setMode(next);
    setStoredAuthMode(next);
    const url = new URL(window.location.href);
    url.searchParams.set("mode", next);
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }

  async function continueSignedIn() {
    if (!user || continuing || switching) return;
    setContinuing(true);
    try {
      if (user.role === "admin") {
        navigate(consumeAuthRedirect("/"));
        return;
      }
      if (!user.onboardingCompleted) {
        navigate("/onboarding");
        return;
      }
      if (mode === user.role) {
        navigate(consumeAuthRedirect(workspaceHomePath(user.role)));
        return;
      }
      await switchTo(mode, { activateIfMissing: true });
    } finally {
      setContinuing(false);
    }
  }

  const panel =
    mode === "seller"
      ? {
          title: (
            <>
              Sell on
              <br />
              Karm Baba
            </>
          ),
          body: "Sign in to your seller account to manage products, respond to RFQs, and grow wholesale orders.",
        }
      : {
          title: (
            <>
              Buy wholesale
              <br />
              with confidence
            </>
          ),
          body: "Sign in as a buyer to source verified manufacturers, shortlist suppliers, and send RFQs.",
        };

  const authReady = clerkLoaded && isLoaded && profileReady;
  const alreadySignedIn = Boolean(authReady && isSignedIn && user);

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-secondary relative overflow-hidden items-center justify-center hero-pattern">
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary/20 rounded-full translate-x-1/3 -translate-y-1/3 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-400/15 rounded-full -translate-x-1/4 translate-y-1/4 blur-3xl" />
        <div className="relative text-center text-white px-12">
          <button type="button" onClick={() => navigate("/")} className="mx-auto mb-6 block">
            <img src={logoUrl} alt="Karm Baba" className="h-16 mx-auto brightness-200" />
          </button>
          <h2 className="font-heading text-3xl font-bold mb-4 leading-tight">{panel.title}</h2>
          <p className="text-white/65 leading-relaxed mb-8">{panel.body}</p>
          <div className="inline-flex rounded-full border border-white/20 bg-white/10 p-1 text-sm">
            <button
              type="button"
              onClick={() => selectMode("buyer")}
              className={`px-4 py-1.5 rounded-full ${mode === "buyer" ? "bg-white text-secondary font-semibold" : "text-white/70 hover:text-white"}`}
            >
              Buyer
            </button>
            <button
              type="button"
              onClick={() => selectMode("seller")}
              className={`px-4 py-1.5 rounded-full ${mode === "seller" ? "bg-white text-secondary font-semibold" : "text-white/70 hover:text-white"}`}
            >
              Seller
            </button>
          </div>
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
            <h1 className="font-heading text-2xl font-bold text-foreground">Sign in</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "seller" ? "Seller centre" : "Buyer account"}
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
                You&apos;re already signed in as{" "}
                <span className="font-semibold text-foreground">{user?.name || user?.email}</span>
                {user?.role ? (
                  <>
                    {" "}
                    ({user.role})
                  </>
                ) : null}
                .{" "}
                {mode === "seller" && !hasSellerAccount
                  ? "Continue to create your seller account on this login."
                  : mode === "buyer" && !hasBuyerAccount
                    ? "Continue to create your buyer account on this login."
                    : "Choose Buyer or Seller above, then continue."}
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
            <SignIn
              // Stable key so toggling Buyer/Seller does not remount Clerk and
              // trigger forceRedirectUrl while a session flickers into existence.
              key="kb-sign-in"
              routing="hash"
              signUpUrl={`/register?mode=${mode}${
                redirect ? `&redirect=${encodeURIComponent(redirect)}` : ""
              }`}
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
            New to Karm Baba?{" "}
            <button
              type="button"
              onClick={() =>
                navigate(
                  `/register?mode=${mode}${
                    redirect ? `&redirect=${encodeURIComponent(redirect)}` : ""
                  }`,
                )
              }
              className="text-primary font-semibold hover:underline"
            >
              Join free as {mode === "seller" ? "Seller" : "Buyer"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
