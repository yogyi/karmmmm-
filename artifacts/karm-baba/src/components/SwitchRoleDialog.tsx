import { useCallback, useState } from "react";
import { useLocation } from "wouter";
import { useAuth as useClerkAuth } from "@clerk/react";
import { useAuth } from "@/context/AuthContext";
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

/** Instant buyer ↔ seller switch (no confirmation dialog). */
export function useSwitchAccountRole() {
  const { user, refreshProfile } = useAuth();
  const { getToken } = useClerkAuth();
  const { alert } = useAppDialog();
  const [, navigate] = useLocation();
  const [switching, setSwitching] = useState(false);

  const switchTo = useCallback(
    async (target?: AuthMode) => {
      if (switching) return;
      const role: AuthMode =
        target ?? (user?.role === "seller" ? "buyer" : "seller");
      if (user?.role === role) {
        navigate(role === "seller" ? "/seller" : "/buyer");
        return;
      }
      setSwitching(true);
      try {
        await applyAccountRole(role, getToken, refreshProfile);
        if (role === "seller") {
          navigate("/seller/verify");
          return;
        }
        navigate(consumeAuthRedirect("/buyer"));
      } catch (e) {
        await alert({
          title: "Could not switch account",
          message: e instanceof Error ? e.message : "Could not switch account",
        });
        setSwitching(false);
      }
    },
    [switching, user?.role, getToken, refreshProfile, navigate, alert],
  );

  return { switchTo, switching };
}
