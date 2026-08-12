import { Building2, ShoppingBag } from "lucide-react";
import type { AuthMode } from "@/lib/authMode";

/**
 * Alibaba-style Buyer | Seller mode switch for sign-in / join flows.
 */
export function AuthModeToggle({
  mode,
  onChange,
}: {
  mode: AuthMode;
  onChange: (mode: AuthMode) => void;
}) {
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      onChange(mode === "buyer" ? "seller" : "buyer");
    }
    if (e.key === "Home") {
      e.preventDefault();
      onChange("buyer");
    }
    if (e.key === "End") {
      e.preventDefault();
      onChange("seller");
    }
  }

  return (
    <div className="mb-6">
      <p className="text-center text-sm text-muted-foreground mb-3" id="auth-mode-label">
        Continue as
      </p>
      <div
        role="tablist"
        aria-labelledby="auth-mode-label"
        onKeyDown={onKeyDown}
        className="grid grid-cols-2 rounded-xl border border-border bg-muted/40 p-1 gap-1"
      >
        <ModeTab
          active={mode === "buyer"}
          onClick={() => onChange("buyer")}
          icon={<ShoppingBag size={16} />}
          label="Buyer"
          hint="Source & RFQ"
        />
        <ModeTab
          active={mode === "seller"}
          onClick={() => onChange("seller")}
          icon={<Building2 size={16} />}
          label="Seller"
          hint="List & quote"
        />
      </div>
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      tabIndex={active ? 0 : -1}
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        active
          ? "bg-white text-foreground shadow-sm ring-1 ring-border"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <span className="flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      <span className="text-[11px] font-normal text-muted-foreground">{hint}</span>
    </button>
  );
}
