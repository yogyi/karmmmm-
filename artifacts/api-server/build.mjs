import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm } from "node:fs/promises";

// Plugins (e.g. 'esbuild-plugin-pino') may use `require` to resolve dependencies
globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));

async function buildAll() {
  const distDir = path.resolve(artifactDir, "dist");
  const apiDir = path.resolve(artifactDir, "api");
  await rm(distDir, { recursive: true, force: true });
  await rm(apiDir, { recursive: true, force: true });

  const shared = {
    platform: "node",
    bundle: true,
    logLevel: "info",
    external: [
      "*.node",
      "sharp",
      "better-sqlite3",
      "sqlite3",
      "canvas",
      "bcrypt",
      "argon2",
      "fsevents",
      "re2",
      "farmhash",
      "xxhash-addon",
      "bufferutil",
      "utf-8-validate",
      "ssh2",
      "cpu-features",
      "dtrace-provider",
      "isolated-vm",
      "lightningcss",
      "pg-native",
      "oracledb",
      "mongodb-client-encryption",
      "nodemailer",
      "handlebars",
      "knex",
      "typeorm",
      "protobufjs",
      "onnxruntime-node",
      "@tensorflow/*",
      "@prisma/client",
      "@mikro-orm/*",
      "@grpc/*",
      "@swc/*",
      "@aws-sdk/*",
      "@azure/*",
      "@opentelemetry/*",
      "@google-cloud/*",
      "@google/*",
      "googleapis",
      "firebase-admin",
      "@parcel/watcher",
      "@sentry/profiling-node",
      "@tree-sitter/*",
      "aws-sdk",
      "classic-level",
      "dd-trace",
      "ffi-napi",
      "grpc",
      "hiredis",
      "kerberos",
      "leveldown",
      "miniflare",
      "mysql2",
      "newrelic",
      "odbc",
      "piscina",
      "realm",
      "ref-napi",
      "rocksdb",
      "sass-embedded",
      "sequelize",
      "serialport",
      "snappy",
      "tinypool",
      "usb",
      "workerd",
      "wrangler",
      "zeromq",
      "zeromq-prebuilt",
      "playwright",
      "puppeteer",
      "puppeteer-core",
      "electron",
    ],
    sourcemap: "linked",
    plugins: [
      esbuildPluginPino({ transports: ["pino-pretty"] }),
    ],
    banner: {
      js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
    `,
    },
  };

  // Local / long-running server entry
  await esbuild({
    ...shared,
    entryPoints: [path.resolve(artifactDir, "src/index.ts")],
    format: "esm",
    outdir: distDir,
    outExtension: { ".js": ".mjs" },
  });

  // Vercel serverless entry — single CJS file with pino left external so
  // esbuild-plugin-pino doesn't collide, and @vercel/node never recompiles
  // workspace TypeScript (avoids "Emit skipped").
  await esbuild({
    platform: "node",
    bundle: true,
    logLevel: "info",
    entryPoints: [path.resolve(artifactDir, "src/vercel.ts")],
    format: "cjs",
    outfile: path.resolve(apiDir, "index.js"),
    sourcemap: false,
    external: [
      ...shared.external,
      "pino",
      "pino-http",
      "pino-pretty",
      "thread-stream",
    ],
    footer: {
      // Ensure Express default export is the CJS module.exports Vercel expects
      js: "module.exports = module.exports.default ?? module.exports;",
    },
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
