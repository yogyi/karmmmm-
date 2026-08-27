import express, { type Express, type NextFunction, type Request, type Response } from "express";
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
// Product/profile JSON may include several image URL strings; keep headroom above default 100kb.
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

if (clerkEnabled) {
  app.use(clerkMiddleware());
  logger.info("Clerk auth middleware enabled");
} else {
  logger.warn(
    "Clerk keys missing — protected routes will return 503 until CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY are set",
  );
}

app.use("/api", router);

/** Unmatched /api paths must return JSON — never fall through to Vite/static (POST would hang). */
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "API route not found" });
});

/** Always return JSON for API failures — never Express HTML error pages. */
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (res.headersSent) return;
  const message = err instanceof Error ? err.message : "Internal server error";
  const isPrisma =
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof (err as { code?: unknown }).code === "string" &&
    String((err as { code: string }).code).startsWith("P");
  const status =
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    Number.isFinite(Number((err as { status?: unknown }).status))
      ? Number((err as { status: number }).status)
      : 500;
  req.log?.error({ err }, "Unhandled API error");
  res.status(status >= 400 && status < 600 ? status : 500).json({
    error: isPrisma
      ? "Database query failed. Please try again or contact support."
      : message.slice(0, 300) || "Internal server error",
  });
});

export default app;
