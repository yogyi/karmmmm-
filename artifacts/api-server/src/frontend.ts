import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Express, NextFunction, Request, Response } from "express";
import express from "express";
import { logger } from "./lib/logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, "../../karm-baba");
const frontendDist = path.resolve(frontendRoot, "dist/public");

/**
 * Serve the React app from the same Express process/port as the API.
 * - development: Vite middleware (HMR)
 * - production: built static files from artifacts/karm-baba/dist/public
 */
export async function attachFrontend(app: Express): Promise<void> {
  const isDev = process.env.NODE_ENV !== "production";

  if (isDev) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      configFile: path.join(frontendRoot, "vite.config.ts"),
      // Same process as Express — do not open a second HTTP server.
      server: {
        middlewareMode: true,
        allowedHosts: true,
        // Avoid Vite reading PORT and trying to bind its own listener.
        hmr: { server: undefined },
      },
      appType: "custom",
    });

    app.use(vite.middlewares);

    app.use(async (req: Request, res: Response, next: NextFunction) => {
      if (req.method !== "GET" && req.method !== "HEAD") {
        next();
        return;
      }
      if (req.path.startsWith("/api")) {
        next();
        return;
      }

      try {
        const url = req.originalUrl;
        const templatePath = path.join(frontendRoot, "index.html");
        let template = await fs.promises.readFile(templatePath, "utf-8");
        template = await vite.transformIndexHtml(url, template);
        res.status(200).setHeader("Content-Type", "text/html").end(template);
      } catch (err) {
        vite.ssrFixStacktrace(err as Error);
        next(err);
      }
    });

    logger.info("Frontend attached via Vite middleware (same port as API)");
    return;
  }

  if (!fs.existsSync(frontendDist)) {
    logger.warn(
      { frontendDist },
      "Frontend build missing — run `pnpm --filter @workspace/karm-baba build`",
    );
    return;
  }

  app.use(express.static(frontendDist, { index: false }));
  app.get("/{*splat}", (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api")) {
      next();
      return;
    }
    res.sendFile(path.join(frontendDist, "index.html"));
  });

  logger.info({ frontendDist }, "Frontend attached via static files");
}
