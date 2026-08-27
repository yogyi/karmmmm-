export type AuthMode = "buyer" | "seller";

const STORAGE_KEY = "kb_auth_mode";

export function parseAuthMode(value: string | null | undefined): AuthMode | null {
  if (value === "buyer" || value === "seller") return value;
  return null;
}

export function getStoredAuthMode(): AuthMode | null {
  if (typeof window === "undefined") return null;
  return parseAuthMode(sessionStorage.getItem(STORAGE_KEY));
}

export function setStoredAuthMode(mode: AuthMode): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, mode);
}

export function clearStoredAuthMode(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}

const PENDING_WORKSPACE_KEY = "kb_pending_workspace";

/** Survives role API calls — used so /buyer is not bounced back to /seller mid-switch. */
export function setPendingWorkspace(mode: AuthMode): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(PENDING_WORKSPACE_KEY, mode);
}

export function getPendingWorkspace(): AuthMode | null {
  if (typeof window === "undefined") return null;
  return parseAuthMode(sessionStorage.getItem(PENDING_WORKSPACE_KEY));
}

export function clearPendingWorkspace(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(PENDING_WORKSPACE_KEY);
}

/** Read ?mode= from the current URL (wouter path may omit search). */
export function getAuthModeFromUrl(): AuthMode | null {
  if (typeof window === "undefined") return null;
  return parseAuthMode(new URLSearchParams(window.location.search).get("mode"));
}

export function resolveInitialAuthMode(fallback: AuthMode = "buyer"): AuthMode {
  return getAuthModeFromUrl() ?? getStoredAuthMode() ?? fallback;
}
