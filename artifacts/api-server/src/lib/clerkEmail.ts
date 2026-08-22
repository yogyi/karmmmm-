type ClerkEmailAddress = {
  emailAddress: string;
  verification?: { status?: string | null } | null;
};

type ClerkUserLike = {
  primaryEmailAddress?: ClerkEmailAddress | null;
  emailAddresses: ClerkEmailAddress[];
};

/**
 * Prefer primary email only when Clerk marks it verified.
 * Blocks account linking via unverified / attacker-controlled addresses.
 */
export function resolveVerifiedClerkEmail(
  clerkUser: ClerkUserLike,
): { ok: true; email: string } | { ok: false; error: string } {
  const primary = clerkUser.primaryEmailAddress;
  if (primary?.emailAddress) {
    if (primary.verification?.status === "verified") {
      return { ok: true, email: primary.emailAddress.toLowerCase() };
    }
    return {
      ok: false,
      error: "Verify your email in Clerk before syncing your Karm Baba profile",
    };
  }

  const verified = clerkUser.emailAddresses.find(
    (e) => e.verification?.status === "verified" && e.emailAddress,
  );
  if (verified?.emailAddress) {
    return { ok: true, email: verified.emailAddress.toLowerCase() };
  }

  if (clerkUser.emailAddresses[0]?.emailAddress) {
    return {
      ok: false,
      error: "Verify your email in Clerk before syncing your Karm Baba profile",
    };
  }

  return { ok: false, error: "Clerk user has no email address" };
}
