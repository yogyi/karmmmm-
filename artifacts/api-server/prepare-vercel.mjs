import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { build as esbuild } from "esbuild";

globalThis.require = createRequire(import.meta.url);

const require = createRequire(import.meta.url);
const artifactDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(artifactDir, "../..");
const frontendDist = path.resolve(artifactDir, "../karm-baba/dist/public");

const FALLBACK_HTML = `<!doctype html><meta charset="utf-8"><title>Karm Baba</title>
<p>Frontend build missing. API: <a href="/api/healthz">/api/healthz</a></p>`;

async function copyIfExists(from, to) {
  if (!existsSync(from)) return false;
  await mkdir(path.dirname(to), { recursive: true });
  await cp(from, to, { recursive: true, dereference: true, force: true });
  return true;
}

async function stageStatic(staticDir) {
  await mkdir(staticDir, { recursive: true });
  if (existsSync(path.join(frontendDist, "index.html"))) {
    await cp(frontendDist, staticDir, { recursive: true });
    return;
  }
  await writeFile(path.join(staticDir, "index.html"), FALLBACK_HTML);
}

async function copyPrisma(funcDir) {
  const clientPkg = require.resolve("@prisma/client/package.json");
  const clientDir = path.dirname(clientPkg);
  await copyIfExists(
    clientDir,
    path.join(funcDir, "node_modules/@prisma/client"),
  );

  const generated = path.resolve(clientDir, "../.prisma");
  await copyIfExists(generated, path.join(funcDir, "node_modules/.prisma"));

  for (const id of [
    "@prisma/debug",
    "@prisma/engines",
    "@prisma/engines-version",
    "@prisma/fetch-engine",
    "@prisma/get-platform",
  ]) {
    try {
      const pkg = path.dirname(require.resolve(`${id}/package.json`));
      await copyIfExists(pkg, path.join(funcDir, "node_modules", id));
    } catch {
      // optional prisma internals differ by version
    }
  }
}

async function bundleHandler(outfile) {
  await mkdir(path.dirname(outfile), { recursive: true });
  await esbuild({
    platform: "node",
    bundle: true,
    logLevel: "info",
    entryPoints: [path.resolve(artifactDir, "src/app.ts")],
    format: "cjs",
    outfile,
    sourcemap: false,
    external: [
      "*.node",
      "@prisma/client",
      ".prisma/client",
    ],
    footer: {
      js: "module.exports = module.exports.default ?? module.exports;",
    },
  });
}

async function writeOutput(outputDir) {
  await rm(outputDir, { recursive: true, force: true });
  const staticDir = path.join(outputDir, "static");
  const funcDir = path.join(outputDir, "functions/index.func");

  await stageStatic(staticDir);
  await mkdir(funcDir, { recursive: true });
  await bundleHandler(path.join(funcDir, "index.js"));
  await copyPrisma(funcDir);

  await writeFile(
    path.join(funcDir, "package.json"),
    JSON.stringify({ type: "commonjs" }),
  );
  await writeFile(
    path.join(funcDir, ".vc-config.json"),
    JSON.stringify({
      runtime: "nodejs22.x",
      handler: "index.js",
      launcherType: "Nodejs",
      shouldAddHelpers: true,
      maxDuration: 30,
    }),
  );
  await writeFile(
    path.join(outputDir, "config.json"),
    JSON.stringify({
      version: 3,
      routes: [
        { src: "^/api(?:/.*)?$", dest: "/index" },
        { handle: "filesystem" },
        { src: "/(.*)", dest: "/index.html" },
      ],
    }),
  );
}

async function mirrorStaticForDashboardOverrides() {
  // If the Vercel dashboard still has Output Directory = dist or public,
  // serve HTML rather than the Node bundle.
  for (const dir of [
    path.join(artifactDir, "public"),
    path.join(artifactDir, "dist"),
  ]) {
    await rm(dir, { recursive: true, force: true });
    await stageStatic(dir);
  }
}

const outputs = new Set([
  path.join(artifactDir, ".vercel/output"),
  path.join(repoRoot, ".vercel/output"),
]);

for (const outputDir of outputs) {
  await writeOutput(outputDir);
}

await mirrorStaticForDashboardOverrides();
