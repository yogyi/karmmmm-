import type { CorsOptions } from "cors";

function normalizeOrigin(value: string): string | null {
  const trimmed = value.trim().replace(/\/$/, "");
  if (!trimmed) return null;
  try {
    if (/^https?:\/\//i.test(trimmed)) {
      return new URL(trimmed).origin;
    }
    // Host without scheme (e.g. VERCEL_URL)
    return new URL(`https://${trimmed}`).origin;
  } catch {
    return null;
  }
}

function collectAllowedOrigins(): Set<string> {
  const origins = new Set<string>();

  const add = (raw?: string | null) => {
    if (!raw) return;
    const origin = normalizeOrigin(raw);
    if (origin) origins.add(origin);
  };

  add(process.env.APP_URL);
  add(process.env.PUBLIC_APP_URL);

  for (const part of (process.env.CORS_ORIGINS ?? "").split(",")) {
    add(part);
  }

  // Vercel deployment + production aliases — required for Blob client uploads
  // when handleUpload is hit cross-origin (or for credentialed API calls).
  if (process.env.VERCEL) {
    add(process.env.VERCEL_URL);
    add(process.env.VERCEL_BRANCH_URL);
    add(process.env.VERCEL_PROJECT_PRODUCTION_URL);
    // Stable production alias used by this project.
    add("karmmmm-api-server-ten.vercel.app");
    add("karmmmm-api-server-yogyis-projects.vercel.app");
  }

  if (origins.size === 0) {
    const port = process.env.PORT || "8080";
    origins.add(`http://localhost:${port}`);
    origins.add(`http://127.0.0.1:${port}`);
  } else {
    // Always allow local dev against a remote API when extras are configured.
    origins.add("http://localhost:8080");
    origins.add("http://127.0.0.1:8080");
    origins.add("http://localhost:5173");
    origins.add("http://127.0.0.1:5173");
  }

  return origins;
}

/**
 * Build an allowlist for credentialed CORS.
 * Never use `origin: true` with `credentials: true` — that reflects any Origin.
 *
 * Configure with:
 * - APP_URL / PUBLIC_APP_URL (preferred production origin)
 * - CORS_ORIGINS (optional comma-separated extras)
 * - On Vercel, deployment/production hosts are added automatically
 */
export function buildCorsOptions(): CorsOptions {
  const origins = collectAllowedOrigins();

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
  return [...collectAllowedOrigins()];
}
