import { describe, expect, it } from "vitest";
import { resolveVerifiedClerkEmail } from "./clerkEmail";

describe("resolveVerifiedClerkEmail", () => {
  it("accepts verified primary", () => {
    const r = resolveVerifiedClerkEmail({
      primaryEmailAddress: {
        emailAddress: "A@Example.com",
        verification: { status: "verified" },
      },
      emailAddresses: [],
    });
    expect(r).toEqual({ ok: true, email: "a@example.com" });
  });

  it("rejects unverified primary", () => {
    const r = resolveVerifiedClerkEmail({
      primaryEmailAddress: {
        emailAddress: "a@example.com",
        verification: { status: "unverified" },
      },
      emailAddresses: [],
    });
    expect(r.ok).toBe(false);
  });

  it("falls back to another verified address", () => {
    const r = resolveVerifiedClerkEmail({
      primaryEmailAddress: null,
      emailAddresses: [
        { emailAddress: "x@ex.com", verification: { status: "unverified" } },
        { emailAddress: "ok@ex.com", verification: { status: "verified" } },
      ],
    });
    expect(r).toEqual({ ok: true, email: "ok@ex.com" });
  });
});
