import { useState } from "react";
import { useLocation } from "wouter";
import { Search, ShoppingBag, ChevronDown, Menu, X, User, LogOut, LayoutDashboard, FileText, Package, IndianRupee, Heart } from "lucide-react";
import { UserButton } from "@clerk/react";
import { useAuth } from "@/context/AuthContext";
import logoUrl from "@assets/logo_1780688383558.png";

export function Header() {
  const [, navigate] = useLocation();
  const { user, logout, isLoggedIn } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  }

  return (
    <header className="bg-white border-b border-border sticky top-0 z-50 shadow-sm">
      {/* Top bar */}
      <div className="bg-secondary text-white text-xs py-1.5 px-4 flex justify-between items-center">
        <span className="hidden sm:flex items-center gap-4 text-white/70">
          <span>📦 India's #1 B2B Wholesale Marketplace</span>
          <span className="text-white/40">|</span>
          <span>🚚 Pan-India Delivery</span>
        </span>
        <div className="flex gap-4 ml-auto items-center">
          {!isLoggedIn ? (
            <>
              <button onClick={() => navigate("/login")} className="hover:text-primary transition-colors font-medium">Sign In</button>
              <span className="text-white/30">|</span>
              <button onClick={() => navigate("/register")} className="hover:text-primary transition-colors font-medium text-white/90">Join Free →</button>
            </>
          ) : (
            <span className="text-white/75 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
              Welcome back, <span className="text-white font-semibold">{user?.name}</span>
            </span>
          )}
        </div>
      </div>

      {/* Main header */}
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
        {/* Logo */}
        <button onClick={() => navigate("/")} className="flex items-center gap-2.5 flex-shrink-0 group">
          <img src={logoUrl} alt="Karm Baba" className="h-10 w-auto group-hover:opacity-90 transition-opacity" />
          <div className="hidden sm:block">
            <div className="text-lg font-heading font-bold text-secondary leading-none">Karm Baba</div>
            <div className="text-[10px] text-muted-foreground font-medium tracking-wide uppercase">B2B Marketplace</div>
          </div>
        </button>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex-1 flex items-center">
          <div className="flex w-full border border-border rounded-xl overflow-hidden focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all shadow-sm">
            <input
              type="text"
              placeholder="Search products, suppliers, categories..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 px-4 py-2.5 text-sm outline-none bg-white placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 flex items-center gap-2 transition-colors font-semibold text-sm flex-shrink-0"
            >
              <Search size={16} />
              <span className="hidden sm:inline">Search</span>
            </button>
          </div>
        </form>

        {/* Right actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => navigate("/shortlist")}
            className="hidden sm:flex items-center gap-1.5 text-sm font-semibold hover:bg-muted px-3 py-2 rounded-xl transition-colors"
            title="Shortlist"
          >
            <Heart size={18} />
          </button>

          <button
            onClick={() => navigate("/rfq/new")}
            className="hidden md:flex items-center gap-1.5 bg-primary text-white hover:bg-primary/90 border border-primary transition-all px-3.5 py-2 rounded-xl text-sm font-semibold shadow-sm"
          >
            <IndianRupee size={15} />
            Get Best Price
          </button>

          <button
            onClick={() => navigate("/rfq/new")}
            className="hidden lg:flex items-center gap-1.5 bg-primary/10 hover:bg-primary hover:text-white text-primary border border-primary/20 hover:border-primary transition-all px-3.5 py-2 rounded-xl text-sm font-semibold"
          >
            <FileText size={15} />
            Post RFQ
          </button>

          {isLoggedIn ? (
            <div className="relative flex items-center gap-2">
              <UserButton afterSignOutUrl="/" />
              <div className="relative hidden sm:block">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 text-sm font-medium hover:bg-muted rounded-xl px-2 py-1.5 transition-colors"
              >
                <span className="max-w-[120px] truncate">{user?.name}</span>
                <ChevronDown size={14} className={`text-muted-foreground transition-transform ${userMenuOpen ? "rotate-180" : ""}`} />
              </button>
              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-xl border border-border py-2 z-50 overflow-hidden">
                    <div className="px-4 py-2 border-b border-border mb-1">
                      <div className="font-semibold text-sm text-foreground">{user?.name}</div>
                      <div className="text-xs text-muted-foreground capitalize">{user?.role} account</div>
                    </div>
                    {(user?.role === "seller" || user?.role === "admin") && (
                      <button
                        onClick={() => { navigate("/dashboard"); setUserMenuOpen(false); }}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-muted flex items-center gap-2.5 transition-colors"
                      >
                        <LayoutDashboard size={15} className="text-muted-foreground" /> Dashboard
                      </button>
                    )}
                    <button
                      onClick={() => { navigate("/products"); setUserMenuOpen(false); }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-muted flex items-center gap-2.5 transition-colors"
                    >
                      <Package size={15} className="text-muted-foreground" /> Browse Products
                    </button>
                    <button
                      onClick={() => { navigate("/rfq"); setUserMenuOpen(false); }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-muted flex items-center gap-2.5 transition-colors"
                    >
                      <FileText size={15} className="text-muted-foreground" /> My RFQs
                    </button>
                    <div className="border-t border-border mt-1 pt-1">
                      <button
                        onClick={() => { logout(); setUserMenuOpen(false); }}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 flex items-center gap-2.5 text-red-600 transition-colors"
                      >
                        <LogOut size={15} /> Sign Out
                      </button>
                    </div>
                  </div>
                </>
              )}
              </div>
            </div>
          ) : (
            <button
              onClick={() => navigate("/login")}
              className="flex items-center gap-1.5 text-sm font-semibold hover:bg-muted px-3 py-2 rounded-xl transition-colors"
            >
              <User size={18} />
              <span className="hidden md:inline">Account</span>
            </button>
          )}

          <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2 rounded-xl hover:bg-muted transition-colors">
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Nav bar */}
      <nav className="border-t border-border bg-white hidden md:block">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-1 py-1.5 text-sm overflow-x-auto">
            {[
              { label: "All Products", path: "/products", icon: <ShoppingBag size={13} /> },
              { label: "Suppliers", path: "/suppliers", icon: null },
              { label: "Textiles", path: "/products?categoryId=2", icon: null },
              { label: "Electronics", path: "/products?categoryId=1", icon: null },
              { label: "Agriculture", path: "/products?categoryId=3", icon: null },
              { label: "Machinery", path: "/products?categoryId=4", icon: null },
            ].map(item => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="px-3 py-1.5 rounded-lg hover:bg-muted hover:text-primary text-muted-foreground font-medium transition-colors whitespace-nowrap flex items-center gap-1.5"
              >
                {item.icon}{item.label}
              </button>
            ))}
            <button
              onClick={() => navigate("/suppliers?verified=true")}
              className="px-3 py-1.5 rounded-lg text-amber-600 font-semibold hover:bg-amber-50 transition-colors flex items-center gap-1 whitespace-nowrap ml-1"
            >
              ✓ Verified Suppliers
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-border bg-white py-3 px-4 space-y-1 shadow-lg">
          {[
            { label: "All Products", path: "/products" },
            { label: "Suppliers", path: "/suppliers" },
            { label: "Post RFQ", path: "/rfq/new" },
            { label: "My RFQs", path: "/rfq" },
            ...(isLoggedIn && (user?.role === "seller" || user?.role === "admin") ? [{ label: "Dashboard", path: "/dashboard" }] : []),
          ].map(item => (
            <button
              key={item.path}
              onClick={() => { navigate(item.path); setMenuOpen(false); }}
              className="block w-full text-left py-2.5 px-3 rounded-xl text-sm hover:bg-muted hover:text-primary transition-colors font-medium"
            >
              {item.label}
            </button>
          ))}
          {!isLoggedIn && (
            <div className="pt-2 flex gap-2">
              <button onClick={() => { navigate("/login"); setMenuOpen(false); }} className="flex-1 border border-border py-2.5 rounded-xl text-sm font-semibold text-center">Sign In</button>
              <button onClick={() => { navigate("/register"); setMenuOpen(false); }} className="flex-1 bg-primary text-white py-2.5 rounded-xl text-sm font-semibold text-center">Join Free</button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
