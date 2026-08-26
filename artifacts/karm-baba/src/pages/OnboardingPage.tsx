import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Building2, ShoppingBag, Loader2 } from "lucide-react";
import { useAuth as useClerkAuth } from "@clerk/react";
import { useAuth } from "@/context/AuthContext";
import {
  type AuthMode,
  clearStoredAuthMode,
  getStoredAuthMode,
} from "@/lib/authMode";
import { consumeAuthRedirect } from "@/lib/authRedirect";
import {
  applyAccountRole,
  useSwitchAccountRole,
} from "@/components/SwitchRoleDialog";
import logoUrl from "@assets/logo_1780688383558.png";

export function OnboardingPage() {
  const { user, isLoggedIn, isLoaded, profileReady, refreshProfile } = useAuth();
  const { getToken } = useClerkAuth();
  const [, navigate] = useLocation();
  const { switchTo, switching } = useSwitchAccountRole();
  const changing =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("change");

  const [choice, setChoice] = useState<AuthMode | null>(() => getStoredAuthMode());
  const [company, setCompany] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoTried, setAutoTried] = useState(false);
  const [switchTried, setSwitchTried] = useState(false);

  async function applyRole(role: AuthMode, companyName?: string) {
    const token = await getToken();
    if (!token) {
      throw new Error("Session expired. Please sign in again.");
    }
    const res = await fetch("/api/users/me/onboarding", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        role,
        company: companyName?.trim() || undefined,
      }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (res.status === 404 && !body?.error) {
        throw new Error(
          "Onboarding API is missing on the server. Restart the API (pnpm dev) and try again.",
        );
      }
      throw new Error(body?.error ?? `Could not save your role (${res.status})`);
    }
    clearStoredAuthMode();
    await refreshProfile();
    if (role === "seller") {
      navigate("/seller/verify");
      return;
    }
    navigate(consumeAuthRedirect("/buyer"));
  }

  // Existing account: switch immediately — no form, no confirm.
  useEffect(() => {
    if (!isLoaded || !profileReady || !isLoggedIn || !user || user.id <= 0) return;
    if (!changing || !user.onboardingCompleted || switchTried || switching) return;
    if (user.role === "admin") {
      navigate(consumeAuthRedirect("/"));
      return;
    }
    setSwitchTried(true);
    void switchTo(user.role === "seller" ? "buyer" : "seller");
  }, [
    isLoaded,
    profileReady,
    isLoggedIn,
    user,
    changing,
    switchTried,
    switching,
    switchTo,
    navigate,
  ]);

  // Alibaba-style: mode chosen on login/register → apply automatically after Clerk.
  useEffect(() => {
    if (!isLoaded || !profileReady || !isLoggedIn || !user || user.id <= 0) return;
    if (user.role === "admin") {
      navigate(consumeAuthRedirect("/"));
      return;
    }
    if (user.onboardingCompleted && !changing) {
      navigate(
        consumeAuthRedirect(user.role === "seller" ? "/seller" : "/buyer"),
      );
      return;
    }
    if (changing) return;
    const pending = getStoredAuthMode();
    if (!pending || autoTried) return;
    setAutoTried(true);
    setSaving(true);
    void applyAccountRole(pending, getToken, refreshProfile)
      .then(() => {
        if (pending === "seller") {
          navigate("/seller/verify");
          return;
        }
        navigate(consumeAuthRedirect("/buyer"));
      })
      .catch((e) => {
        setChoice(pending);
        setError(e instanceof Error ? e.message : "Something went wrong");
        setSaving(false);
      });
  }, [isLoaded, profileReady, isLoggedIn, user, changing, autoTried, navigate, getToken, refreshProfile]);

  if (!isLoaded || !profileReady) {
    return (
      <div className="min-h-screen flex items-center justify-center kb-page">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  if (!isLoggedIn) {
    navigate("/login");
    return null;
  }

  if (user?.role === "admin") {
    return null;
  }

  if (changing && user?.onboardingCompleted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center kb-page gap-3 px-4">
        <Loader2 className="animate-spin text-primary" size={28} />
        <p className="text-sm text-muted-foreground">Switching account…</p>
      </div>
    );
  }

  if (user?.onboardingCompleted && !changing) {
    return (
      <div className="min-h-screen flex items-center justify-center kb-page">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  if (saving && getStoredAuthMode()) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center kb-page gap-3">
        <Loader2 className="animate-spin text-primary" size={28} />
        <p className="text-sm text-muted-foreground">
          Setting up your {getStoredAuthMode()} account…
        </p>
      </div>
    );
  }

  async function saveRole() {
    if (!choice) return;
    setSaving(true);
    setError(null);
    try {
      await applyRole(choice, company);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setSaving(false);
    }
  }

  function submit() {
    if (!choice) {
      setError("Choose how you want to use Karm Baba.");
      return;
    }
    void saveRole();
  }

  return (
    <div className="min-h-full flex flex-col">
      <header className="px-6 py-5 flex items-center justify-between max-w-3xl mx-auto w-full">
        <button type="button" onClick={() => navigate("/")} className="text-left">
          <img src={logoUrl} alt="Karm Baba" className="h-9" />
        </button>
        <span className="text-sm text-muted-foreground truncate max-w-[40%]">
          {user?.email}
        </span>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 pb-16">
        <div className="w-full max-w-2xl">
          <h1 className="font-heading text-3xl font-bold text-foreground mb-2 text-center">
            How will you use Karm Baba?
          </h1>
          <p className="text-muted-foreground text-center mb-10 max-w-lg mx-auto">
            Pick buyer or seller — same idea as Alibaba&apos;s buyer / seller sign-in.
          </p>

          <div className="grid sm:grid-cols-2 gap-4 mb-8">
            <button
              type="button"
              onClick={() => setChoice("buyer")}
              className={`text-left rounded-2xl border-2 p-5 bg-white transition-all ${
                choice === "buyer"
                  ? "border-primary shadow-md ring-2 ring-primary/15"
                  : "border-border hover:border-primary/40"
              }`}
            >
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 ${
                  choice === "buyer" ? "bg-primary text-white" : "bg-muted text-foreground"
                }`}
              >
                <ShoppingBag size={22} />
              </div>
              <div className="font-semibold text-foreground mb-1">I&apos;m a buyer</div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Source products, shortlist suppliers, and send RFQs.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setChoice("seller")}
              className={`text-left rounded-2xl border-2 p-5 bg-white transition-all ${
                choice === "seller"
                  ? "border-primary shadow-md ring-2 ring-primary/15"
                  : "border-border hover:border-primary/40"
              }`}
            >
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 ${
                  choice === "seller" ? "bg-primary text-white" : "bg-muted text-foreground"
                }`}
              >
                <Building2 size={22} />
              </div>
              <div className="font-semibold text-foreground mb-1">I&apos;m a seller</div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                List products, receive RFQs, and manage your shop.
              </p>
            </button>
          </div>

          <label className="block mb-6">
            <span className="text-sm font-medium text-foreground mb-1.5 block">
              Company name{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </span>
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder={
                choice === "seller"
                  ? "Your manufacturing / trading company"
                  : "Your buying company"
              }
              className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>

          {error && <p className="text-sm text-red-600 mb-4 text-center">{error}</p>}

          <button
            type="button"
            disabled={saving || !choice}
            onClick={submit}
            className="w-full bg-primary text-white rounded-xl py-3.5 font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : null}
            Continue as{" "}
            {choice === "seller" ? "Seller" : choice === "buyer" ? "Buyer" : "…"}
          </button>
        </div>
      </main>
    </div>
  );
}
