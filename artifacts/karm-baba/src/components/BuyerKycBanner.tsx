import { useLocation } from "wouter";
import { AlertCircle, ArrowRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { needsBuyerKyc } from "@/lib/buyerKyc";

/** Shown on marketplace pages when the buyer is signed in but has not finished verify. */
export function BuyerKycBanner() {
  const [, navigate] = useLocation();
  const { user, isLoggedIn, profileReady } = useAuth();

  if (!isLoggedIn || !profileReady || !user || !needsBuyerKyc(user)) {
    return null;
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200/80">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-amber-950 flex items-start gap-2 min-w-0">
          <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-700" />
          <span>
            You&apos;re <strong>signed in</strong> but buyer verification isn&apos;t finished yet.
            Complete the ~2 minute setup to send RFQs and open Buyer Central.
          </span>
        </p>
        <button
          type="button"
          onClick={() => navigate("/buyer/verify")}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-amber-900 text-white px-3.5 py-1.5 text-xs font-semibold hover:bg-amber-950 transition-colors"
        >
          Complete verification
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
