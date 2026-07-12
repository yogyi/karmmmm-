import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import {
  CreateUserBody,
  LoginUserBody,
  GetUserParams,
  GetUserResponse,
  LoginUserResponse,
} from "@workspace/api-zod";
import { requireClerkAuth, clerkEnabled } from "../lib/auth";

const router: IRouter = Router();

function safeUser(user: typeof usersTable.$inferSelect) {
  const { password: _pw, clerkId: _clerkId, ...safe } = user;
  return {
    ...safe,
    supplierId: safe.supplierId ? parseInt(safe.supplierId, 10) : null,
    createdAt: safe.createdAt.toISOString(),
  };
}

/**
 * Sync the authenticated Clerk user into our Postgres `users` table.
 * Creates on first sign-in; updates profile fields on subsequent calls.
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
  const roleFromMeta = clerkUser.publicMetadata?.role;
  const role =
    roleFromMeta === "seller" || roleFromMeta === "admin" || roleFromMeta === "buyer"
      ? roleFromMeta
      : "buyer";
  const company =
    typeof clerkUser.publicMetadata?.company === "string"
      ? clerkUser.publicMetadata.company
      : null;

  const [byClerk] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkId, userId));

  if (byClerk) {
    const [updated] = await db
      .update(usersTable)
      .set({ name, email, avatarUrl, role, company })
      .where(eq(usersTable.id, byClerk.id))
      .returning();
    res.json(GetUserResponse.parse(safeUser(updated)));
    return;
  }

  const [byEmail] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email));

  if (byEmail) {
    const [linked] = await db
      .update(usersTable)
      .set({
        clerkId: userId,
        name,
        avatarUrl,
        role: byEmail.role || role,
        company: company ?? byEmail.company,
        password: null,
      })
      .where(eq(usersTable.id, byEmail.id))
      .returning();
    res.json(GetUserResponse.parse(safeUser(linked)));
    return;
  }

  const [created] = await db
    .insert(usersTable)
    .values({
      clerkId: userId,
      name,
      email,
      password: null,
      role,
      company,
      avatarUrl,
    })
    .returning();

  res.status(201).json(GetUserResponse.parse(safeUser(created)));
});

/** Legacy password register — prefer Clerk SignUp in the UI. */
router.post("/users", async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, parsed.data.email));
  if (existing.length > 0) {
    res.status(400).json({ error: "Email already registered" });
    return;
  }

  const [user] = await db.insert(usersTable).values(parsed.data).returning();
  res.status(201).json(GetUserResponse.parse(safeUser(user)));
});

/** Legacy password login — prefer Clerk SignIn in the UI. */
router.post("/users/login", async (req, res): Promise<void> => {
  const parsed = LoginUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, parsed.data.email));

  if (!user || !user.password || user.password !== parsed.data.password) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  res.json(LoginUserResponse.parse(safeUser(user)));
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

  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, userId));
  if (!user) {
    res.status(404).json({ error: "User profile not synced yet. Call POST /api/users/sync." });
    return;
  }

  res.json(GetUserResponse.parse(safeUser(user)));
});

router.get("/users/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetUserParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, params.data.id));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(GetUserResponse.parse(safeUser(user)));
});

export default router;
