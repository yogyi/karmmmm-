import { useLocation } from "wouter";
import logoUrl from "@assets/logo_1780688383558.png";
import { Mail, Phone, MapPin, ArrowRight } from "lucide-react";

export function Footer() {
  const [, navigate] = useLocation();

  return (
    <footer className="bg-secondary text-white mt-16">
      {/* Newsletter strip */}
      <div className="border-b border-white/10 bg-white/5">
        <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <div className="font-heading font-bold text-base">Stay ahead of the market</div>
            <div className="text-white/60 text-sm">Get weekly deals & supplier updates in your inbox</div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <input
              type="email"
              placeholder="your@email.com"
              className="flex-1 sm:w-64 bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/40 outline-none focus:border-primary transition-colors"
            />
            <button className="bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-colors flex-shrink-0">
              Subscribe <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <img src={logoUrl} alt="Karm Baba" className="h-9 w-auto brightness-200" />
              <div>
                <div className="font-heading font-bold text-lg leading-none">Karm Baba</div>
                <div className="text-[10px] text-white/50 font-medium tracking-wide uppercase">B2B Marketplace</div>
              </div>
            </div>
            <p className="text-white/60 text-sm leading-relaxed mb-4">
              India's trusted B2B wholesale marketplace connecting buyers and suppliers since 2020.
            </p>
            <div className="space-y-3 text-sm text-white/55">
              <div className="flex items-start gap-2">
                <Phone size={13} className="flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <a href="tel:+919034975500" className="block hover:text-white transition-colors">+91 90349-75500</a>
                  <a href="tel:+918278270225" className="block hover:text-white transition-colors">+91 82782-70225</a>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Mail size={13} className="flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <a href="mailto:karm@karmbaba.com" className="block hover:text-white transition-colors">karm@karmbaba.com</a>
                  <a href="mailto:yogeshmehta@karmbaba.com" className="block hover:text-white transition-colors">yogeshmehta@karmbaba.com</a>
                  <a href="mailto:maanavdahuja@karmbaba.com" className="block hover:text-white transition-colors">maanavdahuja@karmbaba.com</a>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin size={13} className="flex-shrink-0 mt-0.5" />
                <div className="space-y-2 leading-snug">
                  <p>829, 1st Floor, Sector 18, Huda, Panipat, Haryana, India 132103</p>
                  <p>B-14, New Palam Vihar, Bajghera Road, Sector-110, Gurugram Near Police Check Post, Gurugram, Haryana 122017</p>
                </div>
              </div>
            </div>
          </div>

          {/* For Buyers */}
          <div>
            <h4 className="font-heading font-bold mb-4 text-white/90 text-sm uppercase tracking-wider">For Buyers</h4>
            <div className="space-y-2.5 text-sm text-white/60">
              {[
                { label: "Browse Products", path: "/products" },
                { label: "Find Suppliers", path: "/suppliers" },
                { label: "Post an RFQ", path: "/rfq/new" },
                { label: "My RFQs", path: "/rfq" },
                { label: "Register Free", path: "/register" },
              ].map(item => (
                <button key={`buyer-${item.path}`} onClick={() => navigate(item.path)} className="block hover:text-white hover:translate-x-0.5 transition-all text-left">
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* For Suppliers */}
          <div>
            <h4 className="font-heading font-bold mb-4 text-white/90 text-sm uppercase tracking-wider">For Suppliers</h4>
            <div className="space-y-2.5 text-sm text-white/60">
              {[
                { label: "List Products", path: "/register", id: "list" },
                { label: "Supplier Dashboard", path: "/dashboard", id: "dash" },
                { label: "Supplier Directory", path: "/suppliers", id: "dir" },
                { label: "Verified Badge", path: "/register", id: "badge" },
              ].map(item => (
                <button key={item.id} onClick={() => navigate(item.path)} className="block hover:text-white hover:translate-x-0.5 transition-all text-left">
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Trust */}
          <div>
            <h4 className="font-heading font-bold mb-4 text-white/90 text-sm uppercase tracking-wider">Why Karm Baba</h4>
            <div className="space-y-2.5 text-sm text-white/60">
              {["✓ KYC Verified Suppliers", "✓ Best Wholesale Prices", "✓ 24/7 Buyer Support", "✓ Pan-India Delivery", "✓ Free Registration"].map(item => (
                <div key={item} className="text-sm">{item}</div>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-white/15 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-white/45">
          <div>© 2024 Karm Baba Technologies Pvt. Ltd. All rights reserved.</div>
          <div className="flex gap-5">
            {["Privacy Policy", "Terms of Service", "Refund Policy", "Sitemap"].map(link => (
              <span key={link} className="hover:text-white cursor-pointer transition-colors">{link}</span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
