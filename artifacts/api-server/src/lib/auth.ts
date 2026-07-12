import type { RequestHandler, Request } from "express";

const clerkEnabled = Boolean(
  process.env.CLERK_SECRET_KEY && process.env.CLERK_PUBLISHABLE_KEY,
);

export { clerkEnabled };

/** Require a valid Clerk session for mutating / private routes. */
export const requireClerkAuth: RequestHandler = (req, res, next) => {
  if (!clerkEnabled) {
    // Dev fallback when Clerk isn't configured yet — keep APIs usable with Neon.
    next();
    return;
  }

  // Lazy require so the API can boot without Clerk keys installed in env.
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
