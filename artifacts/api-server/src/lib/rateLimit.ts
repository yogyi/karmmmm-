import type { RequestHandler } from "express";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * Simple in-memory rate limiter (per-process). Enough to blunt credential stuffing
 * on legacy password endpoints; not a substitute for edge/WAF limits in production.
 */
export function rateLimit(options: {
  windowMs: number;
  max: number;
  key?: (req: Parameters<RequestHandler>[0]) => string;
}): RequestHandler {
  const { windowMs, max } = options;
  const keyFn =
    options.key ??
    ((req) => {
      const ip =
        (typeof req.headers["x-forwarded-for"] === "string"
          ? req.headers["x-forwarded-for"].split(",")[0]?.trim()
          : undefined) ||
        req.ip ||
        "unknown";
      return `${req.method}:${req.path}:${ip}`;
    });

  return (req, res, next) => {
    const key = keyFn(req);
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - bucket.count)));
    if (bucket.count > max) {
      res.status(429).json({ error: "Too many requests. Try again later." });
      return;
    }
    next();
  };
}
