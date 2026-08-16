import { useState, useEffect } from "react";
import { Link, useLocation, useSearch } from "wouter";
import {
  Search,
  ShoppingBag,
  ChevronDown,
  Menu,
  X,
  User,
  LogOut,
  LayoutDashboard,
  FileText,
  Package,
  IndianRupee,
  Heart,
  Building2,
  Pencil,
} from "lucide-react";
import { useListCategories } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import logoUrl from "@assets/logo_1780688383558.png";

export function Header() {
  const [location, navigate] = useLocation();
  const searchString = useSearch();
  const { user, logout, isLoggedIn } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { data: categories } = useListCategories();

  useEffect(() => {
    const params = new URLSearchParams(
      searchString.startsWith("?") ? searchString.slice(1) : searchString,
    );
    if (location.startsWith("/products")) {
      setSearchQuery(params.get("search") ?? "");
    }
  }, [location, searchString]);

  useEffect(() => {
    if (!menuOpen && !userMenuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen, userMenuOpen]);

  const isSeller = user?.role === "seller" || user?.role === "admin";
  const isBuyer = user?.role === "buyer";
  const inSellerCentral =
    location.startsWith("/seller") || location.startsWith("/dashboard");
  const inBuyerCentral = location.startsWith("/buyer");
  const workspaceLabel = inSellerCentral
    ? "Seller Central"
    : inBuyerCentral
      ? "Buyer Central"
      : "Karm Baba";
  const nameInitials = (user?.name ?? "U")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase() || "U";

  const currentPath = location.split("?")[0];
  const currentSearch = new URLSearchParams(
    searchString.startsWith("?") ? searchString.slice(1) : searchString,
  );

  function isNavActive(itemPath: string): boolean {
    const [itemBase, itemQuery = ""] = itemPath.split("?");
    const itemParams = new URLSearchParams(itemQuery);
    if (currentPath !== itemBase) return false;

    if (itemParams.has("categoryId")) {
      return currentSearch.get("categoryId") === itemParams.get("categoryId");
    }
    if (itemParams.has("verified")) {
      return currentSearch.get("verified") === itemParams.get("verified");
    }
    if (itemParams.has("tab")) {
      return currentSearch.get("tab") === itemParams.get("tab");
    }

    if (itemBase === "/products") {
      return !currentSearch.get("categoryId");
    }
    if (itemBase === "/suppliers") {
      return currentSearch.get("verified") !== "true";
    }
    if (itemBase === "/seller" || itemBase === "/dashboard") {
      return !currentSearch.get("tab") || currentSearch.get("tab") === "overview";
    }
    return true;
  }

  function navClass(active: boolean, accent = false, flushStart = false): string {
    const pad = flushStart ? "pl-0 pr-3 py-1.5" : "px-3 py-1.5";
    if (active) {
      return accent
        ? `${pad} rounded-lg bg-amber-50 text-amber-700 font-semibold whitespace-nowrap flex items-center gap-1.5`
        : `${pad} rounded-lg bg-primary/10 text-primary font-semibold whitespace-nowrap flex items-center gap-1.5`;
    }
    return accent
      ? `${pad} rounded-lg text-muted-foreground font-medium hover:bg-amber-50 hover:text-amber-700 transition-colors flex items-center gap-1 whitespace-nowrap`
      : `${pad} rounded-lg hover:bg-muted hover:text-primary text-muted-foreground font-medium transition-colors whitespace-nowrap flex items-center gap-1.5`;
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) {
      navigate("/products");
      return;
    }
    navigate(`/products?search=${encodeURIComponent(q)}`);
  }

  /** Shared content column — top bar, logo row, category nav, and page body share this edge. */
  const shell = "max-w-7xl mx-auto w-full px-4";

  return (
    <header className="bg-white border-b border-border sticky top-0 z-50 shadow-sm">
      {/* Top bar — Alibaba-style buyer / seller entry */}
      <div
        className={
          isSeller && inSellerCentral ? "bg-[#1a3a4a] text-white" : "bg-secondary text-white"
        }
      >
        <div className={`${shell} text-xs min-h-9 sm:h-8 flex justify-between items-center gap-4 py-1 sm:py-0`}>
          <span className="hidden sm:flex items-center gap-3 text-white/70 truncate min-w-0">
            {isSeller && inSellerCentral ? (
              <span>Seller Central · Manage products & RFQs</span>
            ) : isBuyer && inBuyerCentral ? (
              <span>Buyer Central · Source · RFQ · Shortlist</span>
            ) : (
              <>
                <span className="truncate">India&apos;s #1 B2B Wholesale Marketplace</span>
                <span className="text-white/40 shrink-0" aria-hidden>
                  |
                </span>
                <span className="shrink-0">Pan-India Delivery</span>
              </>
            )}
          </span>
          <div className="flex gap-1 sm:gap-2 ml-auto items-center shrink-0 w-full sm:w-auto justify-end">
            {!isLoggedIn ? (
              <>
                <button
                  type="button"
                  onClick={() => navigate("/login?mode=buyer")}
                  className="hidden sm:inline-flex items-center min-h-9 px-2.5 rounded-lg hover:bg-white/10 transition-colors font-medium"
                >
                  Buyer sign in
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/login?mode=seller")}
                  className="hidden sm:inline-flex items-center min-h-9 px-2.5 rounded-lg hover:bg-white/10 transition-colors font-medium"
                >
                  Seller sign in
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/register?mode=buyer")}
                  className="inline-flex items-center min-h-9 px-3 rounded-lg bg-primary/90 hover:bg-primary text-white font-semibold transition-colors"
                >
                  Join Free
                </button>
              </>
            ) : (
              <span className="sm:hidden text-white/80 flex items-center gap-1.5 truncate max-w-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block shrink-0" />
                <span className="font-medium truncate">{workspaceLabel}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      <div className={`${shell} py-2.5 sm:py-3`}>
        <div className="flex items-center gap-2 sm:gap-4">
        <button
          type="button"
          onClick={() =>
            navigate(isSeller ? "/seller" : isBuyer ? "/buyer" : "/")
          }
          className="flex items-center gap-2.5 flex-shrink-0 group min-w-0"
        >
          <img
            src={logoUrl}
            alt="Karm Baba"
            className="h-9 sm:h-10 w-auto group-hover:opacity-90 transition-opacity"
          />
          <div className="hidden sm:block text-left">
            <div className="text-lg font-heading font-bold text-secondary leading-none">
              Karm Baba
            </div>
            <div className="text-[10px] text-muted-foreground font-medium tracking-wide uppercase mt-0.5">
              {isSeller ? "Seller Central" : isBuyer ? "Buyer Central" : "B2B Marketplace"}
            </div>
          </div>
        </button>

        {/* Mobile: spacer so avatar + menu sit on the right when seller nav is hidden */}
        {isSeller && inSellerCentral ? <div className="flex-1 md:hidden" aria-hidden /> : null}

        {/* Sellers in Seller Central: ops nav (desktop); mobile uses hamburger */}
        {isSeller && inSellerCentral ? (
          <nav
            className="hidden md:flex flex-1 items-center gap-1 overflow-x-auto text-sm min-w-0"
            aria-label="Seller Central"
          >
            {[
              { label: "Overview", path: "/seller" },
              { label: "Products", path: "/seller?tab=products" },
              { label: "Leads", path: "/seller/leads" },
              { label: "Plans", path: "/seller/plans" },
              { label: "Verification", path: "/seller/verify" },
              { label: "RFQs", path: "/rfq" },
              { label: "Marketplace", path: "/" },
            ].map((item) => {
              const active = isNavActive(item.path);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`px-3 py-2.5 min-h-11 inline-flex items-center rounded-lg font-medium whitespace-nowrap transition-colors ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        ) : (
          <form onSubmit={handleSearch} className="hidden md:flex flex-1 items-center min-w-0" role="search">
            <div className="flex w-full border border-border rounded-xl overflow-hidden focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all shadow-sm">
              <input
                type="search"
                aria-label="Search products"
                placeholder={
                  isBuyer
                    ? "Search products to source..."
                    : "Search products, suppliers, categories..."
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 min-w-0 px-4 py-2.5 text-sm outline-none focus-visible:ring-0 bg-white placeholder:text-muted-foreground"
              />
              <button
                type="submit"
                aria-label="Search"
                className="bg-primary hover:bg-primary/90 text-white min-h-11 px-5 flex items-center gap-2 transition-colors font-semibold text-sm flex-shrink-0 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
              >
                <Search size={16} />
                <span>Search</span>
              </button>
            </div>
          </form>
        )}

        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0 ml-auto md:ml-0">
          {(!isSeller || !inSellerCentral) && (
            <>
              <button
                type="button"
                onClick={() => navigate("/shortlist")}
                className="inline-flex items-center justify-center min-h-11 min-w-11 text-sm font-semibold hover:bg-muted rounded-xl transition-colors"
                title="Shortlist"
                aria-label="Shortlist"
              >
                <Heart size={18} />
              </button>
              <button
                type="button"
                onClick={() => navigate("/rfq/new")}
                className="hidden md:inline-flex items-center gap-1.5 bg-primary text-white hover:bg-primary/90 border border-primary transition-all px-3.5 min-h-11 rounded-xl text-sm font-semibold shadow-sm"
              >
                <IndianRupee size={15} />
                Get Best Price
              </button>
            </>
          )}

          {isLoggedIn ? (
            <div className="relative flex items-center">
              <button
                type="button"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                aria-expanded={userMenuOpen}
                aria-label="Account menu"
                className="flex items-center gap-2 text-sm font-medium hover:bg-muted rounded-xl px-1.5 sm:px-2 min-h-11 transition-colors"
              >
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover border border-border flex-shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="w-8 h-8 rounded-full bg-primary text-white text-xs font-semibold flex items-center justify-center flex-shrink-0">
                    {nameInitials}
                  </span>
                )}
                <span className="max-w-[140px] truncate hidden sm:inline">{user?.name}</span>
                <ChevronDown
                  size={14}
                  className={`text-muted-foreground transition-transform hidden sm:block ${userMenuOpen ? "rotate-180" : ""}`}
                />
              </button>
              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-border py-2 z-50 overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-border mb-1 flex items-center gap-3">
                      {user?.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt=""
                          className="w-10 h-10 rounded-full object-cover border border-border flex-shrink-0"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span className="w-10 h-10 rounded-full bg-primary text-white text-sm font-semibold flex items-center justify-center flex-shrink-0">
                          {nameInitials}
                        </span>
                      )}
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-foreground truncate">
                          {user?.name}
                        </div>
                        <div className="text-xs text-muted-foreground capitalize truncate">
                          {user?.role} ·{" "}
                          {isSeller ? "Seller Central" : "Buyer Central"}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigate("/account");
                        setUserMenuOpen(false);
                      }}
                      className="w-full text-left px-4 min-h-11 py-3 text-sm hover:bg-muted flex items-center gap-2.5 transition-colors"
                    >
                      <Pencil size={15} className="text-muted-foreground" /> Edit profile
                    </button>
                    {isBuyer && (
                      <button
                        type="button"
                        onClick={() => {
                          navigate("/buyer");
                          setUserMenuOpen(false);
                        }}
                        className="w-full text-left px-4 min-h-11 py-3 text-sm hover:bg-muted flex items-center gap-2.5 transition-colors"
                      >
                        <LayoutDashboard size={15} className="text-muted-foreground" />{" "}
                        Buyer Central
                      </button>
                    )}
                    {isSeller && (
                      <button
                        type="button"
                        onClick={() => {
                          navigate("/seller");
                          setUserMenuOpen(false);
                        }}
                        className="w-full text-left px-4 min-h-11 py-3 text-sm hover:bg-muted flex items-center gap-2.5 transition-colors"
                      >
                        <Building2 size={15} className="text-muted-foreground" /> Seller
                        Central
                      </button>
                    )}
                    {isBuyer && (
                      <button
                        type="button"
                        onClick={() => {
                          navigate("/onboarding?change=1");
                          setUserMenuOpen(false);
                        }}
                        className="w-full text-left px-4 min-h-11 py-3 text-sm hover:bg-muted flex items-center gap-2.5 transition-colors"
                      >
                        <Building2 size={15} className="text-muted-foreground" /> Sell on
                        Karm Baba
                      </button>
                    )}
                    {user?.role === "seller" && (
                      <button
                        type="button"
                        onClick={() => {
                          navigate("/onboarding?change=1");
                          setUserMenuOpen(false);
                        }}
                        className="w-full text-left px-4 min-h-11 py-3 text-sm hover:bg-muted flex items-center gap-2.5 transition-colors"
                      >
                        <User size={15} className="text-muted-foreground" /> Switch to
                        buyer
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        navigate("/products");
                        setUserMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-muted flex items-center gap-2.5 transition-colors"
                    >
                      <Package size={15} className="text-muted-foreground" /> Browse
                      Products
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        navigate("/rfq");
                        setUserMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-muted flex items-center gap-2.5 transition-colors"
                    >
                      <FileText size={15} className="text-muted-foreground" /> My RFQs
                    </button>
                    <div className="border-t border-border mt-1 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          logout();
                          setUserMenuOpen(false);
                        }}
                        className="w-full text-left px-4 min-h-11 py-3 text-sm hover:bg-red-50 flex items-center gap-2.5 text-red-600 transition-colors"
                      >
                        <LogOut size={15} /> Sign Out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => navigate("/login?mode=buyer")}
              className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold hover:bg-muted px-3 min-h-11 rounded-xl transition-colors"
            >
              <User size={18} />
              <span className="hidden md:inline">Account</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="md:hidden inline-flex items-center justify-center min-h-11 min-w-11 rounded-xl hover:bg-muted transition-colors focus-visible:ring-2 focus-visible:ring-primary"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        </div>

        {!(isSeller && inSellerCentral) && (
          <form onSubmit={handleSearch} className="md:hidden mt-2.5" role="search">
            <div className="flex w-full border border-border rounded-xl overflow-hidden focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 shadow-sm">
              <input
                type="search"
                aria-label="Search products"
                placeholder="Search products…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 min-w-0 px-3 py-2.5 text-sm outline-none bg-white placeholder:text-muted-foreground"
              />
              <button
                type="submit"
                aria-label="Search"
                className="bg-primary hover:bg-primary/90 text-white min-h-11 min-w-11 flex items-center justify-center flex-shrink-0"
              >
                <Search size={16} />
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Marketplace nav — hide on Seller Central (has its own ops nav) */}
      {!(isSeller && inSellerCentral) && (
        <nav className="border-t border-border bg-white hidden md:block" aria-label="Categories">
          <div className={shell}>
            <div className="flex items-center gap-0.5 py-1.5 text-sm overflow-x-auto">
              {(isBuyer
                ? [
                    { label: "Buyer Central", path: "/buyer", icon: <LayoutDashboard size={13} /> },
                    { label: "All Products", path: "/products", icon: <ShoppingBag size={13} /> },
                    { label: "Suppliers", path: "/suppliers", icon: null },
                    { label: "My RFQs", path: "/rfq", icon: <FileText size={13} /> },
                    { label: "Shortlist", path: "/shortlist", icon: <Heart size={13} /> },
                  ]
                : [
                    { label: "All Products", path: "/products", icon: <ShoppingBag size={13} /> },
                    { label: "Suppliers", path: "/suppliers", icon: null },
                    ...(categories ?? []).slice(0, 4).map((c) => ({
                      label: c.name,
                      path: `/products?categoryId=${c.id}`,
                      icon: null as React.ReactNode,
                    })),
                  ]
              ).map((item, index) => {
                const active = isNavActive(item.path);
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={navClass(active, false, index === 0)}
                    aria-current={active ? "page" : undefined}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                );
              })}
              {!isBuyer && (
                <Link
                  href="/suppliers?verified=true"
                  className={`${navClass(isNavActive("/suppliers?verified=true"), true)} ml-auto`}
                  aria-current={
                    isNavActive("/suppliers?verified=true") ? "page" : undefined
                  }
                >
                  ✓ Verified Suppliers
                </Link>
              )}
            </div>
          </div>
        </nav>
      )}

      {menuOpen && (
        <div
          id="mobile-nav"
          className="md:hidden border-t border-border bg-white shadow-lg"
        >
          <div className={`${shell} py-3 space-y-1`}>
            {(isLoggedIn && isBuyer
              ? [
                  { label: "Buyer Central", path: "/buyer" },
                  { label: "Edit profile", path: "/account" },
                  { label: "Products", path: "/products" },
                  { label: "Suppliers", path: "/suppliers" },
                  { label: "My RFQs", path: "/rfq" },
                  { label: "Shortlist", path: "/shortlist" },
                ]
              : isLoggedIn && isSeller
                ? [
                    { label: "Seller Central", path: "/seller" },
                    { label: "Edit profile", path: "/account" },
                    { label: "Products", path: "/seller?tab=products" },
                    { label: "Leads", path: "/seller/leads" },
                    { label: "Plans", path: "/seller/plans" },
                    { label: "Verification", path: "/seller/verify" },
                    { label: "RFQs", path: "/rfq" },
                    { label: "Marketplace", path: "/" },
                  ]
                : [
                    { label: "All Products", path: "/products" },
                    { label: "Suppliers", path: "/suppliers" },
                    { label: "Post RFQ", path: "/rfq/new" },
                    { label: "Shortlist", path: "/shortlist" },
                  ]
            ).map((item) => (
              <button
                type="button"
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  setMenuOpen(false);
                }}
                className={`block w-full text-left min-h-11 py-3 px-3 rounded-xl text-sm transition-colors font-medium ${
                  isNavActive(item.path)
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted hover:text-primary"
                }`}
                aria-current={isNavActive(item.path) ? "page" : undefined}
              >
                {item.label}
              </button>
            ))}
            {!isLoggedIn && (
              <div className="pt-2 space-y-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigate("/login?mode=buyer");
                      setMenuOpen(false);
                    }}
                    className="flex-1 border border-border py-2.5 rounded-xl text-sm font-semibold text-center"
                  >
                    Buyer sign in
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      navigate("/login?mode=seller");
                      setMenuOpen(false);
                    }}
                    className="flex-1 border border-border py-2.5 rounded-xl text-sm font-semibold text-center"
                  >
                    Seller sign in
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigate("/register?mode=buyer");
                    setMenuOpen(false);
                  }}
                  className="w-full bg-primary text-white py-2.5 rounded-xl text-sm font-semibold text-center"
                >
                  Join Free
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
