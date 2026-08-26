import { useEffect, useState } from "react";
import { SignUp } from "@clerk/react";
import { useLocation, useSearch } from "wouter";
import { AuthModeToggle } from "@/components/AuthModeToggle";
import {
  type AuthMode,
  resolveInitialAuthMode,
  setStoredAuthMode,
} from "@/lib/authMode";
import { clerkAuthRedirectUrls } from "@/lib/authRedirect";
import logoUrl from "@assets/logo_1780688383558.png";

function redirectFromSearch(search: string): string | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return params.get("redirect");
}

export function RegisterPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const [mode, setMode] = useState<AuthMode>(() => resolveInitialAuthMode("buyer"));
  const clerkRedirects = clerkAuthRedirectUrls(search);
  const redirect = redirectFromSearch(search);

  useEffect(() => {
    setStoredAuthMode(mode);
  }, [mode]);

  function selectMode(next: AuthMode) {
    setMode(next);
    setStoredAuthMode(next);
    const url = new URL(window.location.href);
    url.searchParams.set("mode", next);
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }

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
            <h1 className="font-heading text-2xl font-bold text-foreground">Join free</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "seller" ? "Create your seller account" : "Create your buyer account"}
            </p>
          </div>

          <AuthModeToggle mode={mode} onChange={selectMode} />

          <SignUp
            routing="hash"
            signInUrl={`/login?mode=${mode}${
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
