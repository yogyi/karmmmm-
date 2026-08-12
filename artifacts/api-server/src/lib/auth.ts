import type { RequestHandler, Request } from "express";

const clerkEnabled = Boolean(
  process.env.CLERK_SECRET_KEY && process.env.CLERK_PUBLISHABLE_KEY,
);

export { clerkEnabled };

/**
 * Require a valid Clerk session for mutating / private routes.
 * Never open these routes when Clerk is misconfigured — that would be an auth bypass.
 */
export const requireClerkAuth: RequestHandler = (req, res, next) => {
  if (!clerkEnabled) {
    res.status(503).json({
      error:
        "Authentication is not configured. Set CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY.",
    });
    return;
  }

  // Lazy require so the API can still boot for public GETs without Clerk wired in.
  import("@clerk/express")
    .then(({ getAuth }) => {
      const auth = getAuth(req);
      if (!auth.userId) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      next();
    })
    .catch(next);
};

export async function getClerkUserId(req: Request): Promise<string | null> {
  if (!clerkEnabled) return null;
  const { getAuth } = await import("@clerk/express");
  return getAuth(req).userId ?? null;
}
