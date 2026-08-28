import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const routesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../routes");

/** Paths that are intentionally public (catalog, health, blob webhook, plans). */
const PUBLIC_ROUTE_ALLOWLIST = [
  // health
  'router.get("/healthz"',
  // catalog browse
  'router.get("/categories"',
  'router.get("/products"',
  'router.get("/products/featured"',
  'router.get("/products/:id"',
  'router.get("/suppliers"',
  'router.get("/suppliers/featured"',
  'router.get("/suppliers/:id"',
  'router.get("/reviews"',
  'router.get("/dashboard/stats"',
  'router.get("/plans"',
  // Blob client upload webhook (auth inside onBeforeGenerateToken)
  'storagePublicRouter.post("/storage/uploads/blob"',
  // ACL-gated object GET (public ACL or owner session)
  'storagePublicRouter.get("/storage/objects/',
];

const MUTATING = /\b(router|storagePublicRouter)\.(post|put|patch|delete)\s*\(\s*["'`]/;

describe("API route auth guards", () => {
  it("every mutating route declares requireClerkAuth (or is explicitly allowlisted)", () => {
    const files = readdirSync(routesDir).filter(
      (f) => f.endsWith(".ts") && !f.endsWith(".test.ts"),
    );
    const violations: string[] = [];

    for (const file of files) {
      const src = readFileSync(path.join(routesDir, file), "utf8");
      const lines = src.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        if (!MUTATING.test(line)) continue;

        // Look ahead a few lines for requireClerkAuth in the same registration.
        const window = lines.slice(i, Math.min(i + 6, lines.length)).join("\n");
        const hasAuth = /requireClerkAuth/.test(window);
        if (hasAuth) continue;

        const trimmed = line.trim();
        const allowed = PUBLIC_ROUTE_ALLOWLIST.some((prefix) =>
          trimmed.startsWith(prefix),
        );
        if (allowed) continue;

        violations.push(`${file}:${i + 1}: ${trimmed.slice(0, 120)}`);
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("private band mounts requireClerkAuth before rfq/users/storage/leads", () => {
    const index = readFileSync(path.join(routesDir, "index.ts"), "utf8");
    const authIdx = index.indexOf("router.use(requireClerkAuth)");
    const rfqIdx = index.indexOf("router.use(rfqRouter)");
    const usersIdx = index.indexOf("router.use(usersRouter)");
    const storageIdx = index.indexOf("router.use(storageRouter)");
    const leadsIdx = index.indexOf("router.use(leadsRouter)");

    expect(authIdx).toBeGreaterThan(-1);
    expect(rfqIdx).toBeGreaterThan(authIdx);
    expect(usersIdx).toBeGreaterThan(authIdx);
    expect(storageIdx).toBeGreaterThan(authIdx);
    expect(leadsIdx).toBeGreaterThan(authIdx);
  });
});
