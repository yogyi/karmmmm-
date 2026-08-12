import express, { type Express } from "express";
import cors from "cors";
import { pinoHttp } from "pino-http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { clerkMiddleware } from "@clerk/express";
import router from "./routes";
import { logger } from "./lib/logger";
import { buildCorsOptions, listAllowedCorsOrigins } from "./lib/cors";

const app: Express = express();

const clerkEnabled = Boolean(
  process.env.CLERK_SECRET_KEY && process.env.CLERK_PUBLISHABLE_KEY,
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req: IncomingMessage & { id?: string | number | object }) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: ServerResponse) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors(buildCorsOptions()));
logger.info({ origins: listAllowedCorsOrigins() }, "CORS allowlist configured");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (clerkEnabled) {
  app.use(clerkMiddleware());
  logger.info("Clerk auth middleware enabled");
} else {
  logger.warn(
    "Clerk keys missing — protected routes will return 503 until CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY are set",
  );
}

app.use("/api", router);

export default app;
