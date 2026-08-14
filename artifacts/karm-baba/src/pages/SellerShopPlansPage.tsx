import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth as useClerkAuth } from "@clerk/react";
import {
  ArrowLeft,
  Check,
  Loader2,
  Share2,
  Sparkles,
  Copy,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

type Plan = {
  code: string;
  name: string;
  description: string | null;
  maxProducts: number;
  monthlyLeadQuota: number;
  features: string[];
  priceInrMonthly: number | null;
  priceInrYearly: number | null;
  priceUsdMonthly: number | null;
  priceUsdYearly: number | null;
};

type Subscription = {
  planCode: string;
  maxProducts: number;
  monthlyLeadQuota: number;
  features: string[];
  status: string;
  productCount: number;
  leadCountThisMonth: number;
  periodEnd?: string | null;
};

/**
 * Subscription-based shop setup — Free → Pro Trade → Business → Enterprise.
 */
export function SellerShopPlansPage() {
  const [, navigate] = useLocation();
  const { user, isLoaded, isLoggedIn } = useAuth();
  const { getToken } = useClerkAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [region, setRegion] = useState<"inr" | "usd">("inr");
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const authHeaders = useCallback(async () => {
    const token = await getToken();
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }, [getToken]);

  const load = useCallback(async () => {
    setLoading(true);
    const [plansRes, headers] = await Promise.all([
      fetch("/api/plans"),
      authHeaders(),
    ]);
    if (plansRes.ok) {
      const data = (await plansRes.json()) as { items: Plan[] };
      setPlans(data.items);
    }
    const subRes = await fetch("/api/shop/subscription", { headers });
    if (subRes.ok) {
      setSub((await subRes.json()) as Subscription);
    }
    const meRes = await fetch("/api/suppliers/me", { headers });
    if (meRes.ok) {
      const me = (await meRes.json()) as { slug?: string | null };
      setSlug(me.slug ?? null);
    }
    setLoading(false);
  }, [authHeaders]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isLoggedIn) {
      navigate("/login?mode=seller&redirect=/seller/plans");
      return;
    }
    if (user?.role !== "seller" && user?.role !== "admin") {
      navigate("/buyer");
      return;
    }
    void load();
  }, [isLoaded, isLoggedIn, user?.role, load, navigate]);

  async function selectPlan(planCode: string) {
    if (planCode !== "free") {
      const ok = window.confirm(
        "Paid checkout is not live yet. Continue to provision this plan on your shop for testing? Billing will be required before production use.",
      );
      if (!ok) return;
    }
    if (sub?.planCode && planCode === "free" && sub.planCode !== "free") {
      const ok = window.confirm(
        "Downgrade to Free? You may lose paid product and lead limits after the change.",
      );
      if (!ok) return;
    }
    setMessage(null);
    setUpgrading(planCode);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/shop/subscription", {
        method: "POST",
        headers,
        body: JSON.stringify({ planCode, region }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMessage(data.error || "Could not update plan");
        return;
      }
      setMessage(
        planCode === "free"
          ? "Shop is on the Free plan."
          : `Provisioned ${planCode.replace(/_/g, " ")} for testing — payment gateway not connected yet.`,
      );
      await load();
    } finally {
      setUpgrading(null);
    }
  }

  const sharePath = slug ? `/s/${slug}` : null;
  const shareUrl =
    sharePath && typeof window !== "undefined"
      ? `${window.location.origin}${sharePath}`
      : sharePath;

  async function copyShare() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function createShareLink() {
    setMessage(null);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/suppliers/me/share-link", {
        method: "POST",
        headers,
      });
      const data = (await res.json()) as { error?: string; slug?: string };
      if (!res.ok) {
        setMessage(
          data.error || "Could not create share link — finish seller verification first.",
        );
        return;
      }
      if (data.slug) setSlug(data.slug);
      setMessage("Shareable profile card is ready.");
      await load();
    } catch {
      setMessage("Could not create share link.");
    }
  }

  if (!isLoaded || !isLoggedIn) {
    return (
      <div className="min-h-[40vh] flex flex-col items-center justify-center gap-3 px-4">
        <Loader2 className="animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Redirecting to sign in…</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f6f8]">
      <div className="bg-secondary text-white">
        <div className="max-w-6xl mx-auto px-4 py-5 sm:py-8">
          <button
            type="button"
            onClick={() => navigate("/seller")}
            className="inline-flex items-center gap-1 text-white/70 text-sm mb-3 hover:text-white min-h-11"
          >
            <ArrowLeft size={14} /> Seller Central
          </button>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Sparkles size={24} /> Shop & plans
          </h1>
          <p className="text-white/65 text-sm mt-1 max-w-xl">
            Choose a subscription tier for product limits, lead quota, and shareable profile
            cards.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Current usage + share card */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-border p-5">
            <h2 className="font-semibold mb-3">Current plan</h2>
            {sub ? (
              <>
                <p className="text-2xl font-heading font-bold capitalize mb-1">
                  {sub.planCode.replace(/_/g, " ")}
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  {sub.productCount} / {sub.maxProducts} products ·{" "}
                  {sub.leadCountThisMonth} / {sub.monthlyLeadQuota} leads this month
                </p>
                <div className="h-2 bg-muted rounded-full overflow-hidden mb-1">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{
                      width: `${Math.min(100, (sub.productCount / Math.max(1, sub.maxProducts)) * 100)}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">Product catalog usage</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Complete seller verification to activate your free shop.
              </p>
            )}
          </div>

          <div className="bg-white rounded-xl border border-border p-5">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <Share2 size={16} /> Shareable profile card
            </h2>
            {shareUrl ? (
              <>
                <p className="text-sm text-muted-foreground mb-3 break-all font-mono text-xs bg-muted px-3 py-2 rounded-lg">
                  {shareUrl}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void copyShare()}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 min-h-11 rounded-lg border border-border hover:bg-muted"
                  >
                    <Copy size={14} /> {copied ? "Copied" : "Copy link"}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(sharePath!)}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 min-h-11 rounded-lg bg-primary text-white"
                  >
                    <ExternalLink size={14} /> Preview card
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Create your public profile card so buyers can inquire without logging in.
                </p>
                <button
                  type="button"
                  onClick={() => void createShareLink()}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 min-h-11 rounded-lg bg-primary text-white"
                >
                  <Share2 size={14} /> Create shareable card
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">Pricing</span>
          <div className="inline-flex rounded-lg border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setRegion("inr")}
              className={`min-h-11 px-4 text-sm font-semibold ${
                region === "inr" ? "bg-secondary text-white" : "bg-white text-muted-foreground"
              }`}
            >
              INR
            </button>
            <button
              type="button"
              onClick={() => setRegion("usd")}
              className={`min-h-11 px-4 text-sm font-semibold ${
                region === "usd" ? "bg-secondary text-white" : "bg-white text-muted-foreground"
              }`}
            >
              USD
            </button>
          </div>
        </div>

        {message && (
          <div className="rounded-xl border border-border bg-white px-4 py-3 text-sm">
            {message}
          </div>
        )}

        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
          {plans.map((plan) => {
            const current = sub?.planCode === plan.code;
            const price =
              region === "inr"
                ? plan.priceInrMonthly
                : plan.priceUsdMonthly;
            const currency = region === "inr" ? "₹" : "$";
            return (
              <div
                key={plan.code}
                className={`bg-white rounded-xl border p-5 flex flex-col ${
                  current ? "border-primary ring-2 ring-primary/20" : "border-border"
                }`}
              >
                <h3 className="font-heading font-bold text-lg">{plan.name}</h3>
                <p className="text-xs text-muted-foreground mt-1 mb-3 min-h-[2.5rem]">
                  {plan.description}
                </p>
                <p className="text-2xl font-bold mb-1">
                  {price === 0 || price == null
                    ? "Free"
                    : `${currency}${price.toLocaleString()}`}
                  {price != null && price > 0 && (
                    <span className="text-xs font-normal text-muted-foreground"> /mo</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                  {plan.maxProducts} products · {plan.monthlyLeadQuota} leads/mo
                </p>
                <ul className="space-y-1.5 mb-5 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-xs">
                      <Check size={12} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={current || upgrading === plan.code}
                  onClick={() => void selectPlan(plan.code)}
                  className={`w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60 ${
                    current
                      ? "bg-muted text-muted-foreground"
                      : "bg-primary text-white hover:bg-primary/90"
                  }`}
                >
                  {upgrading === plan.code
                    ? "Updating…"
                    : current
                      ? "Current plan"
                      : plan.code === "free"
                        ? "Downgrade to Free"
                        : "Try plan (billing soon)"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
