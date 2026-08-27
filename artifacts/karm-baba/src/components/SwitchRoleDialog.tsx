import { useCallback, useState } from "react";
import { useLocation } from "wouter";
import { useAuth as useClerkAuth } from "@clerk/react";
import { useAuth, type AuthUser } from "@/context/AuthContext";
import { clearStoredAuthMode, type AuthMode } from "@/lib/authMode";
import { consumeAuthRedirect } from "@/lib/authRedirect";
import { useAppDialog } from "@/components/AppDialog";

export async function applyAccountRole(
  role: AuthMode,
  getToken: () => Promise<string | null>,
  refreshProfile: () => Promise<void>,
) {
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
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    if (res.status === 404 && !body?.error) {
      throw new Error(
        "Onboarding API is missing on the server. Restart the API (pnpm dev) and try again.",
      );
    }
    throw new Error(body?.error ?? `Could not switch account (${res.status})`);
  }
  clearStoredAuthMode();
  await refreshProfile();
}

/** True when this Clerk user has finished setup for the given marketplace side. */
export function hasRoleAccount(
  user: AuthUser | null | undefined,
  role: AuthMode,
): boolean {
  if (!user) return false;
  if (role === "buyer") return Boolean(user.buyerEnabled);
  return Boolean(user.sellerEnabled);
}

/**
 * Free buyer ↔ seller toggle is only allowed when both sides are set up
 * on the same Clerk user.
 */
export function canSwitchRolesFreely(user: AuthUser | null | undefined): boolean {
  return Boolean(user?.buyerEnabled && user?.sellerEnabled);
}

/** Where to send users who still need to create the other marketplace side. */
export function missingRoleEntryPath(role: AuthMode): string {
  // Seller side → sign in as seller; buyer side → create buyer account.
  return role === "seller" ? "/login?mode=seller" : "/register?mode=buyer";
}

type SwitchOptions = {
  /**
   * When true (login/register “Continue as…”), allow first-time activation of
   * the missing side instead of redirecting away.
   */
  activateIfMissing?: boolean;
};

/** Instant buyer ↔ seller switch only when both accounts exist. */
export function useSwitchAccountRole() {
  const { user, refreshProfile } = useAuth();
  const { getToken } = useClerkAuth();
  const { alert } = useAppDialog();
  const [, navigate] = useLocation();
  const [switching, setSwitching] = useState(false);

  const switchTo = useCallback(
    async (target?: AuthMode, options?: SwitchOptions) => {
      if (switching) return;
      const role: AuthMode =
        target ?? (user?.role === "seller" ? "buyer" : "seller");
      if (user?.role === role) {
        navigate(role === "seller" ? "/seller" : "/buyer");
        return;
      }

      const freeSwitch = canSwitchRolesFreely(user);
      const fromAuthEntry = Boolean(options?.activateIfMissing);

      // Header / in-app switch: only when both buyer + seller sides exist.
      // Login / register "Continue as…": may activate the missing side.
      if (!freeSwitch && !fromAuthEntry) {
        navigate(missingRoleEntryPath(role));
        return;
      }

      setSwitching(true);
      try {
        await applyAccountRole(role, getToken, refreshProfile);
        if (role === "seller") {
          navigate(consumeAuthRedirect("/seller"));
          return;
        }
        navigate(consumeAuthRedirect("/buyer"));
      } catch (e) {
        await alert({
          title: fromAuthEntry && !hasRoleAccount(user, role)
            ? "Could not create account"
            : "Could not switch account",
          message: e instanceof Error ? e.message : "Could not switch account",
        });
        setSwitching(false);
      }
    },
    [switching, user, getToken, refreshProfile, navigate, alert],
  );

  return {
    switchTo,
    switching,
    canSwitchFreely: canSwitchRolesFreely(user),
    hasBuyerAccount: hasRoleAccount(user, "buyer"),
    hasSellerAccount: hasRoleAccount(user, "seller"),
  };
}
