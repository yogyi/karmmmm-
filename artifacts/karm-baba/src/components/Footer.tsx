import { useState } from "react";
import { useLocation } from "wouter";
import logoUrl from "@assets/logo_1780688383558.png";
import { Mail, Phone, MapPin, ArrowRight } from "lucide-react";

export function Footer() {
  const [, navigate] = useLocation();
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
    <footer className="bg-secondary text-white mt-16">
      <div className="border-b border-white/10 bg-white/5">
        <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <div className="font-heading font-bold text-base">Launch updates</div>
            <div className="text-white/60 text-sm">Leave your email — we&apos;ll notify you when the newsletter goes live</div>
          </div>
          <form onSubmit={subscribe} className="flex flex-col gap-2 w-full sm:w-auto">
            <div className="flex gap-2 w-full sm:w-auto">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                aria-label="Email for launch notification"
                className="flex-1 sm:w-64 min-h-11 bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/40 outline-none focus:border-primary transition-colors"
              />
              <button
                type="submit"
                className="bg-primary hover:bg-primary/90 text-white px-4 min-h-11 rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-colors flex-shrink-0"
              >
                Notify me at launch <ArrowRight size={14} />
              </button>
            </div>
            {newsletterMsg && (
              <p className="text-xs text-white/70" role="status">
                {newsletterMsg}
              </p>
            )}
          </form>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-10 mb-10 items-start">
          <div className="sm:col-span-2 lg:col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <img src={logoUrl} alt="Karm Baba" className="h-9 w-auto brightness-200" />
              <div>
                <div className="font-heading font-bold text-lg leading-none">Karm Baba</div>
                <div className="text-[10px] text-white/50 font-medium tracking-wide uppercase">B2B Marketplace</div>
              </div>
            </div>
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

        <div className="pt-6 border-t border-white/15 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-white/45">
          <div>© {new Date().getFullYear()} Karm Baba Ventures Pvt. Ltd. All rights reserved.</div>
          <nav aria-label="Legal" className="flex flex-wrap justify-center gap-x-5 gap-y-1">
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
