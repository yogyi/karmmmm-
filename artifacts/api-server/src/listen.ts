import app from "./app";
import { attachFrontend } from "./frontend";
import { logger } from "./lib/logger";

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

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening (frontend + API)");
});
