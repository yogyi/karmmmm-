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

export function consumeAuthRedirect(fallback = "/"): string {
  const path = peekAuthRedirect() ?? fallback;
  try {
    sessionStorage.removeItem(REDIRECT_KEY);
  } catch {
    /* ignore */
  }
  return path;
}

/** Clerk post-sign-in: apply Buyer/Seller mode, then open the right workspace. */
export function clerkAuthRedirectUrls(search: string): {
  fallbackRedirectUrl: string;
  forceRedirectUrl: string;
} {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  rememberAuthRedirect(params.get("redirect"));
  const mode = params.get("mode");
  const continuePath =
    mode === "buyer" || mode === "seller"
      ? `/auth/continue?mode=${mode}`
      : "/auth/continue?mode=buyer";
  return {
    fallbackRedirectUrl: continuePath,
    forceRedirectUrl: continuePath,
  };
}
