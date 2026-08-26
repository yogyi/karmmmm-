import app from "./app";
import { attachFrontend } from "./frontend";
import { logger } from "./lib/logger";
import { getObjectStorageDriver } from "./lib/objectStorageBackend";
import { isBlobConfigured } from "./lib/blobObjectStorage";

// Local / container only. Vercel uses the default export from src/index.ts
// (or the prebundled app.cjs) and never loads this file.
const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

await attachFrontend(app);

logger.info(
  {
    driver: getObjectStorageDriver(),
    blobConfigured: isBlobConfigured(),
    nodeEnv: process.env.NODE_ENV ?? "undefined",
  },
  "Object storage ready",
);

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening (frontend + API)");
});
