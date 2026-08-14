import fs from "node:fs";
import path from "node:path";
import express from "express";
import app from "./app";

/**
 * Vercel serverless entry. Serves the SPA from ./public when present
 * (copied during `pnpm run build`), otherwise still answers /api/*.
 */
const publicDir = path.join(process.cwd(), "public");
if (fs.existsSync(path.join(publicDir, "index.html"))) {
  app.use(express.static(publicDir, { index: false }));
  app.get("/{*splat}", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      next();
      return;
    }
    res.sendFile(path.join(publicDir, "index.html"));
  });
}

export default app;
