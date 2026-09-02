import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { motion, useInView } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  ChevronDown,
  Globe,
  Headphones,
  MessageSquareQuote,
  Package,
  Shield,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTrialCurrency } from "@/hooks/useTrialCurrency";
import {
  TRIAL_CURRENCY_LABELS,
  TRIAL_PRICE_INR,
  formatTrialPrice,
  trialRegisterUrl,
  type TrialCurrency,
} from "@/lib/trialPricing";

const STATS = [
  { value: 10000, suffix: "+", label: "Verified Suppliers" },
  { value: 50000, suffix: "+", label: "Products Listed" },
  { value: 40, suffix: "+", label: "Countries Served" },
  { value: 98, suffix: "%", label: "KYC Pass Rate" },
] as const;

const INCLUDED = [
  {
    icon: Package,
    title: "Up to 10 Product Listings",
    desc: "Showcase your best wholesale SKUs with photos, MOQ, and pricing — visible to buyers worldwide.",
  },
  {
    icon: Users,
    title: "25 Buyer Leads / Month",
    desc: "Receive qualified RFQs from importers, distributors, and retailers actively sourcing from India.",
  },
  {
    icon: BadgeCheck,
    title: "Verified Supplier Badge",
    desc: "Stand out with a KYC-verified badge that builds instant trust with international buyers.",
  },
  {
    icon: MessageSquareQuote,
    title: "RFQ Inbox & CRM",
    desc: "Reply to buyer inquiries, track conversations, and close deals — all from one dashboard.",
  },
  {
    icon: Globe,
    title: "Shareable Shop Profile",
    desc: "Get a branded profile link to share on WhatsApp, LinkedIn, or email — your digital storefront.",
  },
  {
    icon: Headphones,
    title: "Priority Onboarding Support",
    desc: "Our team helps you list products, complete KYC, and start receiving leads within 48 hours.",
  },
] as const;

const HOW_IT_WORKS = [
  "We verify your GST / business documents so buyers see you as a trusted manufacturer — not another random listing.",
  "Your products appear in search results across textiles, electronics, agro, machinery, and 50+ categories buyers browse daily.",
  "Buyers post RFQs with quantity, budget, and delivery timeline — you get notified instantly and quote directly.",
  "Overseas importers use Karm Baba to source from India at factory-direct prices — your trial puts you in front of them.",
] as const;

const FAQS = [
  {
    q: "What do I get in the ₹99 trial?",
    a: `For just ₹${TRIAL_PRICE_INR} (or the equivalent in your local currency), you get 14 days of Pro-level access: up to 10 product listings, 25 buyer leads per month, verified supplier badge, RFQ inbox, shareable shop profile, and priority onboarding support.`,
  },
  {
    q: "Is this only for Indian suppliers?",
    a: "The trial is designed for Indian manufacturers, wholesalers, and exporters. Overseas buyers can register separately to source products — but sellers must have a valid Indian business (GST or equivalent documentation).",
  },
  {
    q: "How do overseas buyers find my products?",
    a: "Karm Baba is indexed for global B2B search. Buyers from UAE, USA, UK, Africa, and Southeast Asia browse categories, filter by verification status, and send RFQs directly to suppliers like you.",
  },
  {
    q: "What happens after the 14-day trial?",
    a: "You can continue on the Free plan (limited listings) or upgrade to Pro Trade (₹14,999/mo) for unlimited products and higher lead quotas. No auto-charge — you choose when to upgrade.",
  },
  {
    q: "How quickly can I start receiving leads?",
    a: "Most sellers complete KYC and list their first products within 24–48 hours. Once verified, your products appear in search and you start receiving RFQ notifications immediately.",
  },
  {
    q: "Is payment secure?",
    a: "Yes. We use industry-standard payment gateways. Your ₹99 trial is a one-time charge with no hidden fees. Cancel anytime during the trial — no questions asked.",
  },
  {
    q: "Can I upgrade during the trial?",
    a: "Absolutely. If you're getting great results, upgrade to Pro Trade anytime from your Seller Central dashboard to unlock unlimited listings and 100+ leads per month.",
  },
] as const;

function AnimatedCounter({
  value,
  suffix = "",
  inView,
}: {
  value: number;
  suffix?: string;
  inView: boolean;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const duration = 1400;
    const start = performance.now();
    let frame: number;

    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, value]);

  return (
    <span>
      {display.toLocaleString()}
      {suffix}
    </span>
  );
}

function CurrencyToggle({
  currency,
  onChange,
}: {
  currency: TrialCurrency;
  onChange: (c: TrialCurrency) => void;
}) {
  const options = Object.keys(TRIAL_CURRENCY_LABELS) as TrialCurrency[];

  return (
    <div
      className="inline-flex flex-wrap items-center justify-center gap-1 rounded-full bg-white/10 border border-white/20 p-1"
      role="group"
      aria-label="Select currency"
    >
      {options.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={cn(
            "px-3 py-1.5 rounded-full text-xs font-semibold transition-all",
            currency === c
              ? "bg-primary text-white shadow-md"
              : "text-white/70 hover:text-white hover:bg-white/10",
          )}
        >
          {TRIAL_CURRENCY_LABELS[c]}
        </button>
      ))}
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="kb-card border border-border/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-4 p-5 text-left font-semibold text-secondary hover:bg-muted/40 transition-colors"
        aria-expanded={open}
      >
        <span>{q}</span>
        <ChevronDown
          size={18}
          className={cn("shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>
      {open ? (
        <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed border-t border-border/40 pt-4">
          {a}
        </div>
      ) : null}
    </div>
  );
}

function TrialCta({
  label,
  className,
  onClick,
}: {
  label?: string;
  className?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "kb-btn-primary inline-flex items-center justify-center gap-2 px-6 py-3.5 text-base kb-trial-pulse",
        className,
      )}
    >
      {label ?? "Start My Trial Now"}
      <ArrowRight size={18} />
    </button>
  );
}

export function TrialLandingPage() {
  const [, navigate] = useLocation();
  const { currency, setCurrency } = useTrialCurrency();
  const statsRef = useRef<HTMLDivElement>(null);
  const statsInView = useInView(statsRef, { once: true, margin: "-80px" });
  const formRef = useRef<HTMLDivElement>(null);
  const [stickyVisible, setStickyVisible] = useState(false);

  const priceLabel = formatTrialPrice(currency);
  const isOverseas = currency !== "INR";

  function goToSignup() {
    navigate(trialRegisterUrl());
  }

  function scrollToForm() {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY;
      const formTop = formRef.current?.getBoundingClientRect().top ?? 9999;
      setStickyVisible(y > 400 && formTop > 120);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="relative">
      {/* Hero */}
      <section className="relative overflow-hidden text-white hero-pattern">
        <div className="absolute top-0 right-0 w-[28rem] h-[28rem] bg-primary/20 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/3 blur-3xl pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 py-14 sm:py-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 bg-white/10 border border-white/25 rounded-full px-4 py-1.5 text-sm text-white/90 mb-6"
          >
            <Sparkles size={14} className="text-primary" />
            Limited Time — 14-Day Seller Trial
            <span className="bg-primary/90 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
              New
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="font-heading text-3xl sm:text-5xl lg:text-[3.25rem] font-bold mb-5 leading-[1.12] text-balance"
          >
            List Your Products. Get Real Buyer Leads.{" "}
            <span className="gradient-text">All for Just {priceLabel}.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.12 }}
            className="text-base sm:text-lg text-white/75 max-w-2xl mx-auto mb-8 leading-relaxed"
          >
            Join India&apos;s fastest-growing B2B wholesale marketplace. Connect with verified buyers
            across India and 40+ countries — manufacturers, importers, and distributors ready to
            source from you.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="flex flex-col items-center gap-5 mb-8"
          >
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="glass-card rounded-2xl px-8 py-5 text-center min-w-[200px]">
                <p className="text-xs uppercase tracking-widest text-white/55 font-semibold mb-1">
                  14-day trial
                </p>
                <p className="font-heading text-4xl sm:text-5xl font-bold gradient-text">
                  {priceLabel}
                </p>
                <p className="text-xs text-white/50 mt-1">
                  {isOverseas ? `≈ ₹${TRIAL_PRICE_INR} for Indian sellers` : "one-time · no auto-renew"}
                </p>
              </div>
              <div className="hidden sm:block h-16 w-px bg-white/20" />
              <div className="text-left space-y-2 text-sm text-white/80">
                <p className="flex items-center gap-2">
                  <Check size={16} className="text-green-400 shrink-0" />
                  10 product listings included
                </p>
                <p className="flex items-center gap-2">
                  <Check size={16} className="text-green-400 shrink-0" />
                  25 buyer leads every month
                </p>
                <p className="flex items-center gap-2">
                  <Check size={16} className="text-green-400 shrink-0" />
                  KYC verified badge + CRM
                </p>
              </div>
            </div>

            <CurrencyToggle currency={currency} onChange={setCurrency} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <TrialCta
              label={`Start Trial — ${priceLabel}`}
              onClick={goToSignup}
            />
            <button
              type="button"
              onClick={scrollToForm}
              className="text-white/80 hover:text-white text-sm font-semibold underline-offset-4 hover:underline"
            >
              See what&apos;s included ↓
            </button>
          </motion.div>

          {/* Floating chips */}
          <div className="hidden lg:flex absolute left-4 top-1/3 glass-card rounded-xl px-4 py-3 text-left text-sm animate-[kb-float_4s_ease-in-out_infinite]">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-primary" />
              <div>
                <p className="font-bold text-white">3× more RFQs</p>
                <p className="text-white/55 text-xs">vs. free listing</p>
              </div>
            </div>
          </div>
          <div className="hidden lg:flex absolute right-4 top-1/2 glass-card rounded-xl px-4 py-3 text-left text-sm animate-[kb-float_5s_ease-in-out_infinite_0.5s]">
            <div className="flex items-center gap-2">
              <Globe size={16} className="text-primary" />
              <div>
                <p className="font-bold text-white">40+ countries</p>
                <p className="text-white/55 text-xs">buyers sourcing India</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="border-b border-border/60 bg-white/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-2 font-medium">
            <Shield size={16} className="text-primary" />
            KYC Verified Suppliers
          </span>
          <span className="flex items-center gap-2 font-medium">
            <Globe size={16} className="text-primary" />
            Pan-India + Global Buyers
          </span>
          <span className="flex items-center gap-2 font-medium">
            <BadgeCheck size={16} className="text-primary" />
            India&apos;s #1 B2B Marketplace
          </span>
          <span className="flex items-center gap-2 font-medium">
            <Zap size={16} className="text-primary" />
            Go Live in 48 Hours
          </span>
        </div>
      </section>

      {/* Stats */}
      <section ref={statsRef} className="max-w-5xl mx-auto px-4 py-14 sm:py-16">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              animate={statsInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.08 }}
              className="kb-stat p-6 text-center"
            >
              <p className="font-heading text-2xl sm:text-3xl font-bold text-secondary">
                <AnimatedCounter
                  value={stat.value}
                  suffix={stat.suffix}
                  inView={statsInView}
                />
              </p>
              <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Dark case-study section */}
      <section
        className="relative py-16 sm:py-20 text-white overflow-hidden"
        style={{
          background:
            "linear-gradient(165deg, hsl(220 60% 12%) 0%, hsl(220 50% 18%) 55%, hsl(220 45% 14%) 100%)",
        }}
      >
        <div
          className="pointer-events-none absolute -right-24 top-0 h-80 w-80 rounded-full opacity-20"
          style={{
            background: "radial-gradient(circle, hsl(28 100% 50%) 0%, transparent 70%)",
          }}
        />
        <div className="relative max-w-5xl mx-auto px-4">
          <div className="text-center mb-10">
            <p className="text-primary font-semibold text-sm uppercase tracking-widest mb-3">
              Real Results
            </p>
            <h2 className="font-heading text-2xl sm:text-4xl font-bold mb-4 text-balance">
              From Zero Visibility to{" "}
              <span className="gradient-text">10+ RFQs in 14 Days</span>
            </h2>
            <p className="text-white/65 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
              Textile exporters, electronics wholesalers, and agro suppliers on Karm Baba are
              closing deals with buyers from Dubai, Nairobi, London, and Singapore — without spending
              lakhs on trade fairs.
            </p>
          </div>

          <div className="kb-card bg-white/5 border-white/10 p-6 sm:p-8 mb-8">
            <h3 className="font-heading text-lg font-bold mb-5 flex items-center gap-2">
              But How? 🤔
            </h3>
            <ul className="space-y-4">
              {HOW_IT_WORKS.map((item) => (
                <li key={item} className="flex gap-3 text-sm sm:text-base text-white/80 leading-relaxed">
                  <span className="shrink-0 mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary">
                    <Check size={14} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="text-center">
            <TrialCta
              label={`Claim Trial for ${priceLabel}`}
              onClick={goToSignup}
              className="!bg-white !text-secondary hover:!bg-white/90 !shadow-lg"
            />
          </div>
        </div>
      </section>

      {/* What's included */}
      <section className="max-w-5xl mx-auto px-4 py-16 sm:py-20">
        <div className="text-center mb-12">
          <p className="text-primary font-semibold text-sm uppercase tracking-widest mb-2">
            Everything Included
          </p>
          <h2 className="font-heading text-2xl sm:text-4xl font-bold text-secondary text-balance">
            Your {priceLabel} Trial Unlocks Pro-Level Tools
          </h2>
          <p className="text-muted-foreground mt-3 max-w-xl mx-auto text-sm sm:text-base">
            No credit card tricks. No hidden charges. One payment, full access for 14 days.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {INCLUDED.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="kb-card-interactive p-6"
            >
              <div className="h-11 w-11 rounded-xl bg-accent flex items-center justify-center mb-4">
                <item.icon size={22} className="text-primary" />
              </div>
              <h3 className="font-heading font-bold text-secondary mb-2">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Plan comparison */}
      <section className="bg-muted/50 border-y border-border/50 py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-center text-secondary mb-10">
            Why the Trial Beats Staying on Free
          </h2>

          <div className="grid md:grid-cols-3 gap-4">
            {[
              {
                name: "Free",
                price: "₹0",
                highlight: false,
                features: ["2 product listings", "5 leads / month", "Basic profile", "No verified badge"],
              },
              {
                name: "14-Day Trial",
                price: priceLabel,
                highlight: true,
                features: [
                  "10 product listings",
                  "25 leads / month",
                  "Verified badge",
                  "RFQ CRM + share card",
                  "Priority support",
                ],
              },
              {
                name: "Pro Trade",
                price: currency === "INR" ? "₹14,999/mo" : "$199/mo",
                highlight: false,
                features: [
                  "Unlimited listings",
                  "100+ leads / month",
                  "Featured placement",
                  "Analytics dashboard",
                  "Dedicated manager",
                ],
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className={cn(
                  "kb-card p-6 relative",
                  plan.highlight && "ring-2 ring-primary shadow-lg scale-[1.02]",
                )}
              >
                {plan.highlight ? (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                    Best Value
                  </span>
                ) : null}
                <h3 className="font-heading font-bold text-lg text-secondary">{plan.name}</h3>
                <p className="font-heading text-2xl font-bold text-primary mt-1 mb-4">
                  {plan.price}
                </p>
                <ul className="space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check size={14} className="text-primary shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                {plan.highlight ? (
                  <button
                    type="button"
                    onClick={goToSignup}
                    className="kb-btn-primary w-full mt-6 py-2.5 text-sm"
                  >
                    Start Trial
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section className="max-w-5xl mx-auto px-4 py-16 sm:py-20">
        <h2 className="font-heading text-2xl sm:text-3xl font-bold text-center text-secondary mb-10">
          Trusted by Manufacturers Across India
        </h2>
        <div className="grid sm:grid-cols-3 gap-5">
          {[
            {
              quote:
                "We listed our cotton fabrics on day one and got 3 RFQs from UAE buyers within the first week. The ₹99 trial paid for itself 100× over.",
              name: "Rajesh K.",
              role: "Textile Exporter, Surat",
              stars: 5,
            },
            {
              quote:
                "As an electronics wholesaler, I was skeptical. But the verified badge and CRM made us look professional to overseas importers.",
              name: "Priya M.",
              role: "Electronics Distributor, Delhi NCR",
              stars: 5,
            },
            {
              quote:
                "Our basmati rice brand now gets inquiries from Kenya and South Africa. Karm Baba opened markets we couldn't reach before.",
              name: "Amit S.",
              role: "Agro Exporter, Panipat",
              stars: 5,
            },
          ].map((t) => (
            <div key={t.name} className="kb-card p-6 flex flex-col">
              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: t.stars }).map((_, i) => (
                  <Star key={i} size={14} className="fill-primary text-primary" />
                ))}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed flex-1 italic">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="mt-4 pt-4 border-t border-border/50">
                <p className="font-semibold text-secondary text-sm">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Overseas buyers callout */}
      <section className="max-w-5xl mx-auto px-4 pb-16">
        <div className="kb-card p-8 sm:p-10 flex flex-col md:flex-row items-center gap-8 bg-gradient-to-br from-accent/40 to-white">
          <div className="h-16 w-16 rounded-2xl bg-secondary flex items-center justify-center shrink-0">
            <Building2 size={32} className="text-white" />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h3 className="font-heading text-xl font-bold text-secondary mb-2">
              {isOverseas ? "Sourcing from India?" : "Selling to Overseas Buyers?"}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {isOverseas
                ? "Browse 50,000+ wholesale products from verified Indian manufacturers. Post RFQs, compare quotes, and trade with KYC-verified suppliers — free for buyers."
                : "Buyers from UAE, UK, USA, Africa, and Southeast Asia are actively sourcing textiles, electronics, agro, and machinery from India on Karm Baba. Your trial puts your catalog in front of them."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(isOverseas ? "/register?mode=buyer" : trialRegisterUrl())}
            className="kb-btn-primary px-6 py-3 text-sm shrink-0"
          >
            {isOverseas ? "Start Buying Free" : "List & Sell — " + priceLabel}
          </button>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-muted/40 border-t border-border/50 py-16 sm:py-20">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-10">
            <TrialCta
              label={`Start Trial — ${priceLabel}`}
              onClick={goToSignup}
              className="mb-8"
            />
            <h2 className="font-heading text-2xl sm:text-3xl font-bold text-secondary">
              Frequently Asked Questions
            </h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq) => (
              <FaqItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA / signup */}
      <section
        ref={formRef}
        id="trial-signup"
        className="relative py-16 sm:py-20 text-white hero-pattern"
      >
        <div className="relative max-w-xl mx-auto px-4 text-center">
          <h2 className="font-heading text-2xl sm:text-4xl font-bold mb-4">
            Ready to Get Your First Buyer Lead?
          </h2>
          <p className="text-white/70 mb-8 text-sm sm:text-base leading-relaxed">
            Join thousands of Indian manufacturers already trading on Karm Baba. Start your{" "}
            {priceLabel} trial today — list products, get verified, and receive RFQs within 48
            hours.
          </p>

          <div className="kb-card bg-white p-6 sm:p-8 text-left text-secondary">
            <p className="font-heading font-bold text-lg mb-1">Start your seller trial</p>
            <p className="text-sm text-muted-foreground mb-6">
              Create your free account, complete KYC, and activate your 14-day trial for{" "}
              <strong className="text-primary">{priceLabel}</strong>.
            </p>
            <button
              type="button"
              onClick={goToSignup}
              className="kb-btn-primary w-full py-3.5 text-base kb-trial-pulse"
            >
              Create Seller Account — {priceLabel}
              <ArrowRight size={18} className="inline ml-1" />
            </button>
            <p className="text-xs text-muted-foreground text-center mt-4">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => navigate("/login?mode=seller&redirect=/seller/plans")}
                className="text-primary font-semibold hover:underline"
              >
                Sign in to upgrade
              </button>
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-6 mt-8 text-xs text-white/55">
            <span className="flex items-center gap-1.5">
              <Shield size={14} /> Secure payment
            </span>
            <span className="flex items-center gap-1.5">
              <BadgeCheck size={14} /> GST invoice available
            </span>
            <span className="flex items-center gap-1.5">
              <Headphones size={14} /> +91 90349-75500
            </span>
          </div>
        </div>
      </section>

      {/* Sticky CTA bar */}
      <div
        className={cn(
          "fixed bottom-0 inset-x-0 z-50 transition-transform duration-300 kb-trial-sticky",
          stickyVisible ? "translate-y-0" : "translate-y-full",
        )}
        role="region"
        aria-label="Trial offer"
      >
        <div className="bg-secondary/95 backdrop-blur-md border-t border-white/10 px-4 py-3">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-white font-bold text-sm truncate">
                14-Day Trial — {priceLabel}
              </p>
              <p className="text-white/55 text-xs hidden sm:block">
                10 listings · 25 leads · Verified badge
              </p>
            </div>
            <button
              type="button"
              onClick={goToSignup}
              className="kb-btn-primary shrink-0 px-5 py-2.5 text-sm kb-trial-pulse"
            >
              Start Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
