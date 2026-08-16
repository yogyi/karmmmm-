import { Router, type IRouter, type RequestHandler } from "express";
import { prisma, type Prisma } from "@workspace/db";
import {
  CreateUserBody,
  LoginUserBody,
  GetUserParams,
  GetUserResponse,
  LoginUserResponse,
  CompleteUserOnboardingBody,
} from "@workspace/api-zod";
import { requireClerkAuth, clerkEnabled } from "../lib/auth";
import { getAuthenticatedDbUser, isAdmin } from "../lib/authorize";
import { hashPassword, verifyPassword } from "../lib/password";
import { rateLimit } from "../lib/rateLimit";

const router: IRouter = Router();

/** Legacy password auth is off by default — Clerk is the primary auth path. */
const legacyPasswordAuthEnabled =
  process.env.ALLOW_LEGACY_PASSWORD_AUTH === "true";

const legacyAuthLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

const requireLegacyPasswordAuth: RequestHandler = (req, res, next) => {
  if (!legacyPasswordAuthEnabled) {
    res.status(410).json({
      error:
        "Legacy password auth is disabled. Use Clerk sign-in, or set ALLOW_LEGACY_PASSWORD_AUTH=true.",
    });
    return;
  }
  next();
};

function safeUser(user: Prisma.UserGetPayload<object>) {
  const { password: _pw, clerkId: _clerkId, ...safe } = user;
  return {
    ...safe,
    createdAt: safe.createdAt.toISOString(),
  };
}

/**
 * Sync the authenticated Clerk user into our Postgres `users` table.
 * Creates on first sign-in; updates profile fields on subsequent calls.
 *
 * Role is NOT taken from opaque Clerk publicMetadata for buyer/seller —
 * users choose via POST /users/me/onboarding. Clerk metadata may only
 * elevate to admin.
 */
router.post("/users/sync", requireClerkAuth, async (req, res): Promise<void> => {
  if (!clerkEnabled) {
    res.status(503).json({ error: "Clerk is not configured" });
    return;
  }

  const { clerkClient, getAuth } = await import("@clerk/express");
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const clerkUser = await clerkClient.users.getUser(userId);
  const email =
    clerkUser.primaryEmailAddress?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress;

  if (!email) {
    res.status(400).json({ error: "Clerk user has no email address" });
    return;
  }

  const name =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() ||
    email.split("@")[0];
  const avatarUrl = clerkUser.imageUrl ?? null;
  const metaRole = clerkUser.publicMetadata?.role;
  const isClerkAdmin = metaRole === "admin";
  const companyFromMeta =
    typeof clerkUser.publicMetadata?.company === "string"
      ? clerkUser.publicMetadata.company
      : null;

  const byClerk = await prisma.user.findUnique({ where: { clerkId: userId } });

  if (byClerk) {
    const data: Prisma.UserUpdateInput = { email };
    if (!byClerk.avatarUrl && avatarUrl) {
      data.avatarUrl = avatarUrl;
    }
    if (isClerkAdmin && byClerk.role !== "admin") {
      data.role = "admin";
      data.onboardingCompleted = true;
    }
    if (!byClerk.company && companyFromMeta) {
      data.company = companyFromMeta;
    }
    const updated = await prisma.user.update({
      where: { id: byClerk.id },
      data,
    });
    res.json(GetUserResponse.parse(safeUser(updated)));
    return;
  }

  const byEmail = await prisma.user.findUnique({ where: { email } });

  if (byEmail) {
    const linked = await prisma.user.update({
      where: { id: byEmail.id },
      data: {
        clerkId: userId,
        name,
        avatarUrl,
        role: isClerkAdmin ? "admin" : byEmail.role,
        onboardingCompleted: isClerkAdmin ? true : byEmail.onboardingCompleted,
        company: byEmail.company ?? companyFromMeta,
        password: null,
      },
    });
    res.json(GetUserResponse.parse(safeUser(linked)));
    return;
  }

  const created = await prisma.user.create({
    data: {
      clerkId: userId,
      name,
      email,
      password: null,
      role: isClerkAdmin ? "admin" : "buyer",
      company: companyFromMeta,
      avatarUrl,
      onboardingCompleted: isClerkAdmin,
    },
  });

  res.status(201).json(GetUserResponse.parse(safeUser(created)));
});

/**
 * Explicit buyer/seller choice from the onboarding UI.
 * Does not allow self-assigning admin.
 * If the Clerk user is authenticated but not yet in Postgres (race with sync),
 * create/link the row first, then apply the role.
 */
router.post(
  "/users/me/onboarding",
  requireClerkAuth,
  async (req, res): Promise<void> => {
    if (!clerkEnabled) {
      res.status(503).json({ error: "Clerk is not configured" });
      return;
    }

    const parsed = CompleteUserOnboardingBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { getAuth, clerkClient } = await import("@clerk/express");
    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    let user = await prisma.user.findUnique({ where: { clerkId: userId } });

    // Race-safe: profile may not be synced yet when onboarding fires immediately.
    if (!user) {
      const clerkUser = await clerkClient.users.getUser(userId);
      const email =
        clerkUser.primaryEmailAddress?.emailAddress ??
        clerkUser.emailAddresses[0]?.emailAddress;
      if (!email) {
        res.status(400).json({ error: "Clerk user has no email address" });
        return;
      }
      const name =
        [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() ||
        email.split("@")[0];
      const avatarUrl = clerkUser.imageUrl ?? null;
      const byEmail = await prisma.user.findUnique({ where: { email } });
      if (byEmail) {
        user = await prisma.user.update({
          where: { id: byEmail.id },
          data: {
            clerkId: userId,
            name,
            avatarUrl,
            password: null,
          },
        });
      } else {
        user = await prisma.user.create({
          data: {
            clerkId: userId,
            name,
            email,
            password: null,
            role: "buyer",
            avatarUrl,
            onboardingCompleted: false,
          },
        });
      }
    }

    if (user.role === "admin") {
      res.status(403).json({
        error: "Admin accounts cannot change role via onboarding",
      });
      return;
    }

    const company =
      typeof parsed.data.company === "string" && parsed.data.company.trim()
        ? parsed.data.company.trim()
        : user.company;

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        role: parsed.data.role,
        company,
        onboardingCompleted: true,
      },
    });

    // Keep Clerk metadata in sync for dashboards — app role source of truth is Postgres.
    try {
      await clerkClient.users.updateUserMetadata(userId, {
        publicMetadata: {
          role: parsed.data.role,
          ...(company ? { company } : {}),
        },
      });
    } catch (err) {
      console.warn("Failed to mirror role to Clerk publicMetadata", err);
    }

    res.json(GetUserResponse.parse(safeUser(updated)));
  },
);

/** Legacy password register — disabled unless ALLOW_LEGACY_PASSWORD_AUTH=true. Prefer Clerk. */
router.post(
  "/users",
  requireClerkAuth,
  requireLegacyPasswordAuth,
  legacyAuthLimiter,
  async (req, res): Promise<void> => {
    const parsed = CreateUserBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) {
      res.status(400).json({ error: "Email already registered" });
      return;
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const user = await prisma.user.create({
      data: {
        ...parsed.data,
        password: passwordHash,
        onboardingCompleted: true,
      },
    });
    res.status(201).json(GetUserResponse.parse(safeUser(user)));
  },
);

/** Legacy password login — disabled unless ALLOW_LEGACY_PASSWORD_AUTH=true. Prefer Clerk. */
router.post(
  "/users/login",
  requireClerkAuth,
  requireLegacyPasswordAuth,
  legacyAuthLimiter,
  async (req, res): Promise<void> => {
    const parsed = LoginUserBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });

    if (!user?.password) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const ok = await verifyPassword(parsed.data.password, user.password);
    if (!ok) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    res.json(LoginUserResponse.parse(safeUser(user)));
  },
);

router.patch("/users/me", requireClerkAuth, async (req, res): Promise<void> => {
  if (!clerkEnabled) {
    res.status(503).json({ error: "Clerk is not configured" });
    return;
  }

  const { getAuth, clerkClient } = await import("@clerk/express");
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!user) {
    res.status(404).json({ error: "User profile not synced yet. Call POST /api/users/sync." });
    return;
  }

  const body = req.body as { name?: unknown; company?: unknown; avatarUrl?: unknown };
  const name =
    typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  if (!name || name.length < 2) {
    res.status(400).json({ error: "Enter your name (at least 2 characters)" });
    return;
  }
  if (name.length > 80) {
    res.status(400).json({ error: "Name is too long" });
    return;
  }

  let company = user.company;
  if (typeof body.company === "string") {
    const trimmed = body.company.trim().replace(/\s+/g, " ");
    company = trimmed ? trimmed.slice(0, 120) : null;
  }

  let avatarUrl: string | null | undefined;
  if (body.avatarUrl === null || body.avatarUrl === "") {
    avatarUrl = null;
  } else if (typeof body.avatarUrl === "string") {
    const url = body.avatarUrl.trim();
    if (
      !url.startsWith("/api/storage/") &&
      !url.startsWith("https://") &&
      !url.startsWith("http://")
    ) {
      res.status(400).json({ error: "Invalid profile photo URL" });
      return;
    }
    avatarUrl = url.slice(0, 500);
  }

  const parts = name.split(" ");
  const firstName = parts[0] ?? name;
  const lastName = parts.slice(1).join(" ");
  try {
    await clerkClient.users.updateUser(userId, {
      firstName,
      lastName: lastName || undefined,
    });
  } catch (err) {
    console.warn("Failed to update Clerk name", err);
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      name,
      company,
      ...(avatarUrl !== undefined ? { avatarUrl } : {}),
    },
  });

  res.json(GetUserResponse.parse(safeUser(updated)));
});

router.get("/users/me", requireClerkAuth, async (req, res): Promise<void> => {
  if (!clerkEnabled) {
    res.status(503).json({ error: "Clerk is not configured" });
    return;
  }

  const { getAuth } = await import("@clerk/express");
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!user) {
    res.status(404).json({ error: "User profile not synced yet. Call POST /api/users/sync." });
    return;
  }

  res.json(GetUserResponse.parse(safeUser(user)));
});

router.get("/users/:id", requireClerkAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetUserParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const dbUser = await getAuthenticatedDbUser(req);
  if (!dbUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (!isAdmin(dbUser) && dbUser.id !== params.data.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: params.data.id } });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(GetUserResponse.parse(safeUser(user)));
});

export default router;
