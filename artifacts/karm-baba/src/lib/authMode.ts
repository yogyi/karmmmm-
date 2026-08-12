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

/** Read ?mode= from the current URL (wouter path may omit search). */
export function getAuthModeFromUrl(): AuthMode | null {
  if (typeof window === "undefined") return null;
  return parseAuthMode(new URLSearchParams(window.location.search).get("mode"));
}

export function resolveInitialAuthMode(fallback: AuthMode = "buyer"): AuthMode {
  return getAuthModeFromUrl() ?? getStoredAuthMode() ?? fallback;
}
