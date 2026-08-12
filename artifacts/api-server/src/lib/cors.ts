import type { CorsOptions } from "cors";

/**
 * Build an allowlist for credentialed CORS.
 * Never use `origin: true` with `credentials: true` — that reflects any Origin.
 *
 * Configure with:
 * - APP_URL (single app origin, e.g. http://localhost:8080)
 * - CORS_ORIGINS (optional comma-separated extras)
 */
export function buildCorsOptions(): CorsOptions {
  const origins = new Set<string>();

  const appUrl = process.env.APP_URL?.trim();
  if (appUrl) origins.add(appUrl.replace(/\/$/, ""));

  const extras = process.env.CORS_ORIGINS ?? "";
  for (const part of extras.split(",")) {
    const origin = part.trim().replace(/\/$/, "");
    if (origin) origins.add(origin);
  }

  // Local single-port defaults when nothing is configured.
  if (origins.size === 0) {
    const port = process.env.PORT || "8080";
    origins.add(`http://localhost:${port}`);
    origins.add(`http://127.0.0.1:${port}`);
  }

  return {
    credentials: true,
    origin(origin, callback) {
      // Non-browser / same-origin requests often omit Origin.
      if (!origin) {
        callback(null, true);
        return;
      }
      if (origins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
  };
}

export function listAllowedCorsOrigins(): string[] {
  const opts = buildCorsOptions();
  // Recompute for logging (same logic as above).
  const origins = new Set<string>();
  const appUrl = process.env.APP_URL?.trim();
  if (appUrl) origins.add(appUrl.replace(/\/$/, ""));
  for (const part of (process.env.CORS_ORIGINS ?? "").split(",")) {
    const origin = part.trim().replace(/\/$/, "");
    if (origin) origins.add(origin);
  }
  if (origins.size === 0) {
    const port = process.env.PORT || "8080";
    origins.add(`http://localhost:${port}`);
    origins.add(`http://127.0.0.1:${port}`);
  }
  void opts;
  return [...origins];
}
