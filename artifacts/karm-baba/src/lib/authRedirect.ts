const REDIRECT_KEY = "kb_post_auth_redirect";

/** Safe in-app path only (blocks open redirects). */
export function sanitizeRedirect(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let path = raw.trim();
  try {
    if (path.startsWith("http://") || path.startsWith("https://")) {
      const u = new URL(path);
      path = u.pathname + u.search + u.hash;
    }
  } catch {
    return null;
  }
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  if (path.startsWith("/login") || path.startsWith("/register")) return null;
  if (path.startsWith("/auth/continue")) return null;
  return path;
}

export function rememberAuthRedirect(raw: string | null | undefined): void {
  const path = sanitizeRedirect(raw);
  if (!path) return;
  try {
    sessionStorage.setItem(REDIRECT_KEY, path);
  } catch {
    /* ignore */
  }
}

export function peekAuthRedirect(): string | null {
  try {
    return sanitizeRedirect(sessionStorage.getItem(REDIRECT_KEY));
  } catch {
    return null;
  }
}

export function clearAuthRedirect(): void {
  try {
    sessionStorage.removeItem(REDIRECT_KEY);
  } catch {
    /* ignore */
  }
}

export function consumeAuthRedirect(fallback = "/"): string {
  const path = peekAuthRedirect() ?? fallback;
  clearAuthRedirect();
  return path;
}

function isSellerPath(path: string): boolean {
  return (
    path === "/seller" ||
    path.startsWith("/seller/") ||
    path === "/dashboard" ||
    path.startsWith("/dashboard?")
  );
}

function isBuyerWorkspacePath(path: string): boolean {
  return (
    path === "/buyer" ||
    path.startsWith("/buyer?") ||
    path === "/buyer/verify" ||
    path.startsWith("/buyer/verify?")
  );
}

/**
 * After Buyer/Seller login, never honor a remembered redirect for the other side
 * (e.g. stale redirect=/seller while signing in as buyer).
 */
export function resolvePostAuthPath(
  mode: "buyer" | "seller",
  fallback: string,
): string {
  const remembered = peekAuthRedirect();
  clearAuthRedirect();
  if (!remembered) return fallback;
  if (mode === "buyer" && isSellerPath(remembered)) return fallback;
  if (mode === "seller" && isBuyerWorkspacePath(remembered)) return fallback;
  return remembered;
}

function absoluteAppUrl(path: string): string {
  if (typeof window === "undefined") return path;
  try {
    return new URL(path, window.location.origin).toString();
  } catch {
    return path;
  }
}

/** Clerk post-sign-in: apply Buyer/Seller mode, then open the right workspace. */
export function clerkAuthRedirectUrls(search: string): {
  fallbackRedirectUrl: string;
  forceRedirectUrl: string;
} {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  const mode = params.get("mode");
  const redirect = params.get("redirect");

  // Drop cross-mode redirects so Buyer login never reopens Seller Central.
  if (mode === "buyer" && redirect && isSellerPath(redirect)) {
    clearAuthRedirect();
  } else if (mode === "seller" && redirect && isBuyerWorkspacePath(redirect)) {
    clearAuthRedirect();
  } else {
    rememberAuthRedirect(redirect);
  }

  const continuePath =
    mode === "buyer" || mode === "seller"
      ? `/auth/continue?mode=${mode}`
      : "/auth/continue?mode=buyer";
  const absolute = absoluteAppUrl(continuePath);
  return {
    fallbackRedirectUrl: absolute,
    forceRedirectUrl: absolute,
  };
}
