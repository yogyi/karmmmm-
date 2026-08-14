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

const VERCEL_ENGINE = "libquery_engine-rhel-openssl-3.0.x.so.node";

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
  const clientDir = path.dirname(require.resolve("@prisma/client/package.json"));
  await copyIfExists(
    clientDir,
    path.join(funcDir, "node_modules/@prisma/client"),
  );

  // @prisma/client lives at node_modules/@prisma/client
  // generated client lives at node_modules/.prisma (two levels up, not ../.prisma)
  const generatedCandidates = [
    path.resolve(clientDir, "../../.prisma"),
    path.resolve(clientDir, "../.prisma"),
    path.join(repoRoot, "node_modules/.prisma"),
  ];

  const destPrisma = path.join(funcDir, "node_modules/.prisma");
  let copied = false;
  for (const from of generatedCandidates) {
    if (await copyIfExists(from, destPrisma)) {
      copied = true;
      break;
    }
  }

  if (!copied) {
    throw new Error(
      "Prisma generated client not found. Run: pnpm --filter @workspace/db run generate",
    );
  }

  const engine = path.join(destPrisma, "client", VERCEL_ENGINE);
  if (!existsSync(engine)) {
    throw new Error(
      `Missing ${VERCEL_ENGINE}. Add binaryTargets rhel-openssl-3.0.x and re-run prisma generate.`,
    );
  }
}

async function bundleHandler(outfile) {
  await mkdir(path.dirname(outfile), { recursive: true });
  await esbuild({
    platform: "node",
    bundle: true,
    logLevel: "info",
    entryPoints: [path.resolve(artifactDir, "src/vercel-handler.ts")],
    format: "cjs",
    outfile,
    sourcemap: false,
    external: ["*.node", "@prisma/client", ".prisma/client"],
    footer: {
      js: "module.exports = module.exports.default ?? module.exports;",
    },
  });
}

async function writeOutput(outputDir) {
  await rm(outputDir, { recursive: true, force: true });
  const staticDir = path.join(outputDir, "static");
  const funcDir = path.join(outputDir, "functions/api.func");

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
        { handle: "filesystem" },
        { src: "^/api(?:/.*)?$", dest: "/api" },
        { src: "/(.*)", dest: "/index.html" },
      ],
    }),
  );
}

async function mirrorStaticForDashboardOverrides() {
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
