import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import { cp, mkdir, writeFile } from "node:fs/promises";

globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(artifactDir, "public");
const frontendDist = path.resolve(artifactDir, "../karm-baba/dist/public");

async function copyFrontend() {
  await mkdir(publicDir, { recursive: true });
  try {
    await cp(frontendDist, publicDir, { recursive: true });
  } catch {
    await writeFile(
      path.join(publicDir, "index.html"),
      `<!doctype html><meta charset="utf-8"><title>Karm Baba</title>
<p>Frontend build missing. API: <a href="/api/healthz">/api/healthz</a></p>`,
    );
  }
}

async function bundleExpressEntry() {
  // Root app.cjs is first in Vercel's Express entry search list. Bundling
  // workspace TypeScript here avoids @vercel/node "Emit skipped" on .ts pkgs.
  await esbuild({
    platform: "node",
    bundle: true,
    logLevel: "info",
    entryPoints: [path.resolve(artifactDir, "src/app.ts")],
    format: "cjs",
    outfile: path.resolve(artifactDir, "app.cjs"),
    sourcemap: false,
    external: [
      "*.node",
      "sharp",
      "better-sqlite3",
      "sqlite3",
      "canvas",
      "bcrypt",
      "argon2",
      "fsevents",
      "@prisma/client",
      ".prisma/client",
    ],
    footer: {
      js: "module.exports = module.exports.default ?? module.exports;",
    },
  });
}

await copyFrontend();
await bundleExpressEntry();
