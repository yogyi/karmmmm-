import { useState } from "react";
import { Link, useLocation } from "wouter";
import logoUrl from "@assets/logo_1780688383558.png";
import { Mail, Phone, MapPin, ArrowRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { workspaceHomePath } from "@/lib/workspaceHome";

export function Footer() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const isSeller = user?.role === "seller";
  const isBuyer = user?.role === "buyer";
  const homePath = workspaceHomePath(user?.role);
  const [email, setEmail] = useState("");
  const [newsletterMsg, setNewsletterMsg] = useState<string | null>(null);

  function subscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setNewsletterMsg("Enter a valid email address.");
      return;
    }
    setNewsletterMsg("Got it — we’ll notify you at launch. Newsletter signup isn’t live yet.");
    setEmail("");
  }

  return (
    <footer
      className="text-white mt-0 relative z-0 overflow-hidden"
      style={{
        background:
          "linear-gradient(165deg, hsl(220 60% 12%) 0%, hsl(220 50% 18%) 55%, hsl(220 45% 14%) 100%)",
      }}
    >
      <div
        className="pointer-events-none absolute -right-20 top-0 h-72 w-72 rounded-full opacity-25"
        style={{
          background: "radial-gradient(circle, hsl(28 100% 50%) 0%, transparent 70%)",
        }}
      />
      <div className="relative border-b border-white/10 bg-white/[0.04]">
        <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 text-center sm:text-left">
            <div className="font-heading font-bold text-base">Launch updates</div>
            <div className="text-white/60 text-sm leading-relaxed">
              Leave your email — we&apos;ll notify you when the newsletter goes live
            </div>
          </div>
          <form onSubmit={subscribe} className="flex flex-col gap-2 w-full sm:w-auto min-w-0 sm:max-w-md lg:max-w-none">
            <div className="flex flex-col gap-2 w-full sm:flex-row sm:items-stretch">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                aria-label="Email for launch notification"
                className="w-full min-w-0 flex-1 min-h-11 bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/40 outline-none focus:border-primary transition-colors"
              />
              <button
                type="submit"
                className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white px-4 min-h-11 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors shrink-0"
              >
                <span className="sm:hidden">Notify me</span>
                <span className="hidden sm:inline">Notify me at launch</span>
                <ArrowRight size={14} className="shrink-0" />
              </button>
            </div>
            {newsletterMsg && (
              <p className="text-xs text-white/70 text-center sm:text-left" role="status">
                {newsletterMsg}
              </p>
            )}
          </form>
        </div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-10 mb-10 items-start">
          <div className="sm:col-span-2 lg:col-span-2">
            <Link
              href={homePath}
              className="flex items-center gap-2.5 mb-4 cursor-pointer hover:opacity-90 transition-opacity w-fit"
              aria-label={
                homePath === "/seller"
                  ? "Go to Seller Central home"
                  : homePath === "/buyer"
                    ? "Go to Buyer Central home"
                    : "Go to Karm Baba home"
              }
            >
              <img src={logoUrl} alt="" className="h-9 w-auto brightness-200 pointer-events-none" />
              <div>
                <div className="font-heading font-bold text-lg leading-none">Karm Baba</div>
                <div className="text-[10px] text-white/50 font-medium tracking-wide uppercase">B2B Marketplace</div>
              </div>
            </Link>
            <p className="text-white/60 text-sm leading-relaxed mb-4 max-w-md">
              India&apos;s trusted B2B wholesale marketplace connecting buyers and suppliers since 2020.
            </p>
            <div className="space-y-3 text-sm text-white/55">
              <div className="flex items-start gap-2">
                <Phone size={13} className="flex-shrink-0 mt-0.5" aria-hidden />
                <div className="flex flex-col gap-1">
                  <a href="tel:+919034975500" className="hover:text-white transition-colors">+91 90349-75500</a>
                  <a href="tel:+918278270225" className="hover:text-white transition-colors">+91 82782-70225</a>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Mail size={13} className="flex-shrink-0 mt-0.5" aria-hidden />
                <div className="flex flex-col gap-1 break-all">
                  <a href="mailto:karm@karmbaba.com" className="hover:text-white transition-colors">karm@karmbaba.com</a>
                  <a href="mailto:yogeshmehta@karmbaba.com" className="hover:text-white transition-colors">yogeshmehta@karmbaba.com</a>
                  <a href="mailto:maanavdahuja@karmbaba.com" className="hover:text-white transition-colors">maanavdahuja@karmbaba.com</a>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin size={13} className="flex-shrink-0 mt-0.5" aria-hidden />
                <div className="flex flex-col gap-2 leading-snug">
                  <p>
                    <span className="block text-white/80 font-medium">Gurugram Headquarters</span>
                    S-27, 3rd Floor, S Block, New Palam Vihar, Dwarka Expressway, Gurugram, Haryana – 122017, India
                  </p>
                  <p>
                    <span className="block text-white/80 font-medium">Panipat</span>
                    829, Sector-18, In Front Of Aadi Store, Panipat, Haryana, 132103
                  </p>
                </div>
              </div>
            </div>
          </div>

          {!isSeller && (
          <nav aria-label="For buyers" className="min-w-0">
            <h4 className="font-heading font-bold mb-4 text-white/90 text-sm uppercase tracking-wider">
              For Buyers
            </h4>
            <ul className="flex flex-col gap-2 text-sm text-white/60">
              {[
                { label: "Browse Products", path: "/products" },
                { label: "Find Suppliers", path: "/suppliers" },
                { label: "Request Quote", path: "/rfq/new" },
                { label: "Buyer Central", path: "/buyer" },
              ].map((link) => (
                <li key={link.path}>
                  <button
                    type="button"
                    onClick={() => navigate(link.path)}
                    className="w-full text-left py-1.5 hover:text-white transition-colors"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          )}

          {!isBuyer && (
          <nav aria-label="For sellers" className="min-w-0">
            <h4 className="font-heading font-bold mb-4 text-white/90 text-sm uppercase tracking-wider">
              For Sellers
            </h4>
            <ul className="flex flex-col gap-2 text-sm text-white/60">
              {[
                { label: "Seller Central", path: "/seller" },
                { label: "Verification", path: "/seller/verify" },
                { label: "CRM Leads", path: "/seller/leads" },
                { label: "Shop Plans", path: "/seller/plans" },
                ...(isSeller
                  ? [{ label: "Incoming RFQs", path: "/rfq" }]
                  : []),
              ].map((link) => (
                <li key={link.path}>
                  <button
                    type="button"
                    onClick={() => navigate(link.path)}
                    className="w-full text-left py-1.5 hover:text-white transition-colors"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          )}

          <div className="min-w-0">
            <h4 className="font-heading font-bold mb-4 text-white/90 text-sm uppercase tracking-wider">
              Why Karm Baba
            </h4>
            <ul className="flex flex-col gap-2 text-sm text-white/60">
              {[
                "KYC Verified Suppliers",
                "Best Wholesale Prices",
                "24/7 Buyer Support",
                "Pan-India Delivery",
                "Free Registration",
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-primary flex-shrink-0" aria-hidden>
                    ✓
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="pt-6 border-t border-white/15 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-white/45 text-center sm:text-left">
          <div className="px-2">© {new Date().getFullYear()} Karm Baba Ventures Pvt. Ltd. All rights reserved.</div>
          <nav aria-label="Legal" className="flex flex-wrap justify-center gap-x-4 gap-y-1">
            {[
              { label: "Privacy Policy", path: "/privacy" },
              { label: "Terms of Service", path: "/terms" },
              { label: "Refund Policy", path: "/refund" },
              { label: "Home", path: "/" },
            ].map((link) => (
              <button
                key={link.path + link.label}
                type="button"
                onClick={() => navigate(link.path)}
                className="hover:text-white transition-colors py-2"
              >
                {link.label}
              </button>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
