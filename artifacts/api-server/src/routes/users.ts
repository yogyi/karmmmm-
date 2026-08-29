import { Router, type IRouter, type RequestHandler } from "express";
import { prisma, type Prisma } from "@workspace/db";
import {
  CreateUserBody,
  LoginUserBody,
  GetUserParams,
  GetUserResponse,
  CompleteUserOnboardingBody,
} from "@workspace/api-zod";
import { requireClerkAuth, clerkEnabled } from "../lib/auth";
import { getAuthenticatedDbUser, isAdmin } from "../lib/authorize";
import { hashPassword, verifyPassword } from "../lib/password";
import { rateLimit } from "../lib/rateLimit";
import { resolveVerifiedClerkEmail } from "../lib/clerkEmail";
import { validateBusinessEmail } from "../lib/businessEmail";
import { isIndiaCountry, isValidContactPhone } from "../lib/country";
import { buyerKycPublicFields } from "../lib/buyerKyc";
import {
  generateEmailOtp,
  hashEmailOtp,
  otpExpiresAt,
  otpResendAllowed,
} from "../lib/emailOtp";
import {
  confirmEmailOtp,
  confirmWhatsappOtp,
  deliverEmailOtp,
  deliverWhatsappOtp,
  encodeSendmatorSession,
  isSendmatorSession,
} from "../lib/otpDelivery";
import { normalizeWhatsappTo } from "../lib/whatsappOtp";

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
  const {
    password: _pw,
    clerkId: _clerkId,
    buyerCompanyEmailOtpHash: _eHash,
    buyerCompanyEmailOtpExpiresAt: _eExp,
    buyerWhatsappOtpHash: _wHash,
    buyerWhatsappOtpExpiresAt: _wExp,
    ...safe
  } = user;
  return {
    ...safe,
    createdAt: safe.createdAt.toISOString(),
    buyerKycCompletedAt: safe.buyerKycCompletedAt
      ? safe.buyerKycCompletedAt.toISOString()
      : null,
  };
}

/** Core User schema + overseas buyer KYC public fields (OTP hashes never included). */
function jsonUser(user: Prisma.UserGetPayload<object>) {
  const kyc = buyerKycPublicFields(user);
  const core = GetUserResponse.parse(safeUser(user));
  return { ...core, ...kyc, buyerKycCompleted: kyc.buyerKycCompleted };
}

function normalizeWebsite(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const withProto = t.includes("://") ? t : `https://${t}`;
    const u = new URL(withProto);
    if (!u.hostname.includes(".")) return null;
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
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
  const emailResult = resolveVerifiedClerkEmail(clerkUser);
  if (!emailResult.ok) {
    res.status(403).json({ error: emailResult.error });
    return;
  }
  const email = emailResult.email;

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
    // Keep Postgres name in sync with Clerk / avoid stale placeholders like "Buyer".
    const placeholderNames = new Set(["buyer", "seller", "user", "admin"]);
    const dbName = (byClerk.name ?? "").trim();
    const clerkNameFresh = name.trim();
    if (
      clerkNameFresh &&
      (dbName !== clerkNameFresh) &&
      (!dbName || placeholderNames.has(dbName.toLowerCase()))
    ) {
      data.name = clerkNameFresh;
    }
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
    res.json(jsonUser(updated));
    return;
  }

  const byEmail = await prisma.user.findUnique({ where: { email } });

  if (byEmail) {
    if (byEmail.clerkId && byEmail.clerkId !== userId) {
      res.status(409).json({
        error:
          "This email is already linked to another Clerk account. Sign in with that account or contact support.",
      });
      return;
    }
    // Link Clerk id; never clear an existing password hash (account-takeover risk).
    const linked = await prisma.user.update({
      where: { id: byEmail.id },
      data: {
        clerkId: userId,
        name,
        avatarUrl,
        role: isClerkAdmin ? "admin" : byEmail.role,
        onboardingCompleted: isClerkAdmin ? true : byEmail.onboardingCompleted,
        company: byEmail.company ?? companyFromMeta,
      },
    });
    res.json(jsonUser(linked));
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

  res.status(201).json(jsonUser(created));
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
      const emailResult = resolveVerifiedClerkEmail(clerkUser);
      if (!emailResult.ok) {
        res.status(403).json({ error: emailResult.error });
        return;
      }
      const email = emailResult.email;
      const name =
        [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() ||
        email.split("@")[0];
      const avatarUrl = clerkUser.imageUrl ?? null;
      const byEmail = await prisma.user.findUnique({ where: { email } });
      if (byEmail) {
        if (byEmail.clerkId && byEmail.clerkId !== userId) {
          res.status(409).json({
            error:
              "This email is already linked to another Clerk account. Sign in with that account or contact support.",
          });
          return;
        }
        user = await prisma.user.update({
          where: { id: byEmail.id },
          data: {
            clerkId: userId,
            name,
            avatarUrl,
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

    // Login / register /auth/continue may activate a missing side (`source: auth_entry`).
    // In-app switches require both sides already enabled (enforced here, not only on client).
    const bodyRaw = (req.body ?? {}) as { source?: unknown };
    const fromAuthEntry = bodyRaw.source === "auth_entry";
    const activatingSeller = parsed.data.role === "seller" && !user.sellerEnabled;
    const activatingBuyer = parsed.data.role === "buyer" && !user.buyerEnabled;
    if (
      !fromAuthEntry &&
      !activatingSeller &&
      !activatingBuyer &&
      parsed.data.role !== user.role &&
      (!user.buyerEnabled || !user.sellerEnabled)
    ) {
      res.status(403).json({
        error:
          "Set up both buyer and seller profiles before switching roles in the app. Use login/register to activate the missing side.",
      });
      return;
    }
    // First-time activation of the other side is only allowed from auth entry
    // (login/register/continue), not from the in-app header toggle.
    if (!fromAuthEntry && (activatingSeller || activatingBuyer)) {
      res.status(403).json({
        error:
          "Activate the missing buyer or seller side from login/register, then you can switch freely in the app.",
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
        ...(parsed.data.role === "buyer"
          ? { buyerEnabled: true }
          : { sellerEnabled: true }),
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

    res.json(jsonUser(updated));
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
        ...(parsed.data.role === "seller"
          ? { sellerEnabled: true }
          : { buyerEnabled: true }),
      },
    });
    res.status(201).json(jsonUser(user));
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

    res.json(jsonUser(user));
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

  res.json(jsonUser(updated));
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

  res.json(jsonUser(user));
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

  res.json(jsonUser(user));
});

const buyerKycLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 12,
  key: (req) => {
    const uid = (req as { clerkUserId?: string }).clerkUserId || "unknown";
    return `buyer-kyc:user:${uid}`;
  },
});

/**
 * India buyers: one tap — no uploads, no OTP.
 * Marks buyer KYC complete so they skip the overseas 2-step flow.
 */
router.post(
  "/users/me/buyer-kyc/india",
  requireClerkAuth,
  buyerKycLimiter,
  async (req, res): Promise<void> => {
    const dbUser = await getAuthenticatedDbUser(req);
    if (!dbUser) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (dbUser.role === "admin") {
      res.json(jsonUser(dbUser));
      return;
    }

    const updated = await prisma.user.update({
      where: { id: dbUser.id },
      data: {
        buyerCountry: "India",
        buyerKycCompleted: true,
        buyerKycCompletedAt: new Date(),
        buyerEnabled: true,
        buyerCompanyEmail: null,
        buyerCompanyEmailVerified: false,
        buyerCompanyEmailOtpHash: null,
        buyerCompanyEmailOtpExpiresAt: null,
        buyerWhatsapp: null,
        buyerWhatsappVerified: false,
        buyerWhatsappOtpHash: null,
        buyerWhatsappOtpExpiresAt: null,
        buyerRegistrationNumber: null,
        buyerWebsite: null,
      },
    });
    res.json(jsonUser(updated));
  },
);

/** Overseas step 1: send OTP to company-domain email. */
router.post(
  "/users/me/buyer-kyc/email-otp",
  requireClerkAuth,
  buyerKycLimiter,
  async (req, res): Promise<void> => {
    const dbUser = await getAuthenticatedDbUser(req);
    if (!dbUser) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (!otpResendAllowed(dbUser.buyerCompanyEmailOtpExpiresAt)) {
      res.status(429).json({ error: "Wait about a minute before requesting another code" });
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const rawEmail =
      (typeof body.email === "string" && body.email.trim()) ||
      dbUser.buyerCompanyEmail ||
      "";
    const biz = validateBusinessEmail(rawEmail);
    if (!biz.ok) {
      res.status(400).json({ error: biz.error });
      return;
    }

    const code = generateEmailOtp();
    const hash = hashEmailOtp(code, biz.email);
    const expires = otpExpiresAt();

    await prisma.user.update({
      where: { id: dbUser.id },
      data: {
        buyerCompanyEmail: biz.email,
        buyerCompanyEmailVerified: false,
        buyerCompanyEmailOtpHash: hash,
        buyerCompanyEmailOtpExpiresAt: expires,
        buyerKycCompleted: false,
        buyerKycCompletedAt: null,
      },
    });

    const sent = await deliverEmailOtp(biz.email, code);
    if (!sent.ok) {
      res.status(502).json({ error: sent.error });
      return;
    }

    if (sent.usesSendmator && sent.sessionToken) {
      await prisma.user.update({
        where: { id: dbUser.id },
        data: {
          buyerCompanyEmailOtpHash: encodeSendmatorSession(sent.sessionToken),
        },
      });
    }

    res.json({
      sent: true,
      email: biz.email,
      expiresAt: expires.toISOString(),
      ...(sent.previewCode ? { previewCode: sent.previewCode } : {}),
      message:
        sent.mode === "dev-log"
          ? "Dev mode: OTP logged on server (and returned as previewCode)"
          : sent.mode === "sendmator"
            ? `Verification code sent to ${biz.email}`
            : `Code sent to ${biz.email}`,
    });
  },
);

router.post(
  "/users/me/buyer-kyc/email-otp/confirm",
  requireClerkAuth,
  buyerKycLimiter,
  async (req, res): Promise<void> => {
    const dbUser = await getAuthenticatedDbUser(req);
    if (!dbUser) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!/^\d{6}$/.test(code)) {
      res.status(400).json({ error: "Enter the 6-digit code from your email" });
      return;
    }
    const email = dbUser.buyerCompanyEmail ?? "";
    const usesSendmator = isSendmatorSession(dbUser.buyerCompanyEmailOtpHash);
    if (
      !usesSendmator &&
      (!dbUser.buyerCompanyEmailOtpExpiresAt ||
        dbUser.buyerCompanyEmailOtpExpiresAt.getTime() < Date.now())
    ) {
      res.status(400).json({ error: "Code expired — request a new one" });
      return;
    }

    const confirmed = await confirmEmailOtp(
      dbUser.id,
      email,
      code,
      dbUser.buyerCompanyEmailOtpHash,
    );
    if (!confirmed.ok) {
      if (confirmed.locked) {
        await prisma.user.update({
          where: { id: dbUser.id },
          data: {
            buyerCompanyEmailOtpHash: null,
            buyerCompanyEmailOtpExpiresAt: null,
          },
        });
      }
      res.status(confirmed.status).json({ error: confirmed.error });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: dbUser.id },
      data: {
        buyerCompanyEmailVerified: true,
        buyerCompanyEmailOtpHash: null,
        buyerCompanyEmailOtpExpiresAt: null,
      },
    });
    res.json({
      verified: true,
      email: updated.buyerCompanyEmail,
      user: jsonUser(updated),
      message: "Company email verified",
    });
  },
);

/** Overseas step 1: send OTP to WhatsApp. */
router.post(
  "/users/me/buyer-kyc/whatsapp-otp",
  requireClerkAuth,
  buyerKycLimiter,
  async (req, res): Promise<void> => {
    const dbUser = await getAuthenticatedDbUser(req);
    if (!dbUser) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (!otpResendAllowed(dbUser.buyerWhatsappOtpExpiresAt)) {
      res.status(429).json({ error: "Wait about a minute before requesting another code" });
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const rawPhone =
      (typeof body.whatsapp === "string" && body.whatsapp.trim()) ||
      dbUser.buyerWhatsapp ||
      "";
    const countryHint =
      (typeof body.country === "string" && body.country.trim()) ||
      dbUser.buyerCountry ||
      "AE";
    if (!isValidContactPhone(rawPhone, countryHint) && !normalizeWhatsappTo(rawPhone)) {
      res.status(400).json({
        error: "Enter a valid WhatsApp number with country code (e.g. +2547… or +9715…)",
      });
      return;
    }
    const to = normalizeWhatsappTo(rawPhone);
    if (!to) {
      res.status(400).json({
        error: "Enter a valid WhatsApp number with country code (e.g. +2547… or +9715…)",
      });
      return;
    }

    const code = generateEmailOtp();
    const hash = hashEmailOtp(code, to);
    const expires = otpExpiresAt();

    await prisma.user.update({
      where: { id: dbUser.id },
      data: {
        buyerWhatsapp: to,
        buyerWhatsappVerified: false,
        buyerWhatsappOtpHash: hash,
        buyerWhatsappOtpExpiresAt: expires,
        buyerKycCompleted: false,
        buyerKycCompletedAt: null,
      },
    });

    const sent = await deliverWhatsappOtp(to, code);
    if (!sent.ok) {
      res.status(502).json({ error: sent.error });
      return;
    }

    if (sent.usesSendmator && sent.sessionToken) {
      await prisma.user.update({
        where: { id: dbUser.id },
        data: {
          buyerWhatsappOtpHash: encodeSendmatorSession(sent.sessionToken),
        },
      });
    }

    res.json({
      sent: true,
      whatsapp: to,
      expiresAt: expires.toISOString(),
      ...(sent.previewCode ? { previewCode: sent.previewCode } : {}),
      message:
        sent.mode === "dev-log"
          ? "Dev mode: WhatsApp OTP logged on server (and returned as previewCode)"
          : sent.mode === "sendmator"
            ? `Verification code sent to WhatsApp ${to}`
            : `Code sent to WhatsApp ${to}`,
    });
  },
);

router.post(
  "/users/me/buyer-kyc/whatsapp-otp/confirm",
  requireClerkAuth,
  buyerKycLimiter,
  async (req, res): Promise<void> => {
    const dbUser = await getAuthenticatedDbUser(req);
    if (!dbUser) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!/^\d{6}$/.test(code)) {
      res.status(400).json({ error: "Enter the 6-digit code from WhatsApp" });
      return;
    }
    const phone = dbUser.buyerWhatsapp ?? "";
    const usesSendmator = isSendmatorSession(dbUser.buyerWhatsappOtpHash);
    if (
      !usesSendmator &&
      (!dbUser.buyerWhatsappOtpExpiresAt ||
        dbUser.buyerWhatsappOtpExpiresAt.getTime() < Date.now())
    ) {
      res.status(400).json({ error: "Code expired — request a new one" });
      return;
    }

    const confirmed = await confirmWhatsappOtp(
      dbUser.id,
      phone,
      code,
      dbUser.buyerWhatsappOtpHash,
    );
    if (!confirmed.ok) {
      if (confirmed.locked) {
        await prisma.user.update({
          where: { id: dbUser.id },
          data: {
            buyerWhatsappOtpHash: null,
            buyerWhatsappOtpExpiresAt: null,
          },
        });
      }
      res.status(confirmed.status).json({ error: confirmed.error });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: dbUser.id },
      data: {
        buyerWhatsappVerified: true,
        buyerWhatsappOtpHash: null,
        buyerWhatsappOtpExpiresAt: null,
      },
    });
    res.json({
      verified: true,
      whatsapp: updated.buyerWhatsapp,
      user: jsonUser(updated),
      message: "WhatsApp verified",
    });
  },
);

/**
 * Overseas step 2: company registration number + country + website.
 * Completes buyer KYC when email + WhatsApp are already verified.
 */
router.post(
  "/users/me/buyer-kyc/profile",
  requireClerkAuth,
  buyerKycLimiter,
  async (req, res): Promise<void> => {
    const dbUser = await getAuthenticatedDbUser(req);
    if (!dbUser) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (!dbUser.buyerCompanyEmailVerified || !dbUser.buyerWhatsappVerified) {
      res.status(400).json({
        error: "Verify company email and WhatsApp first (step 1)",
      });
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const country =
      typeof body.country === "string" ? body.country.trim().slice(0, 80) : "";
    const reg =
      typeof body.registrationNumber === "string"
        ? body.registrationNumber.trim().slice(0, 80)
        : "";
    const websiteRaw = typeof body.website === "string" ? body.website : "";
    const website = normalizeWebsite(websiteRaw);

    if (!country) {
      res.status(400).json({ error: "Select your country" });
      return;
    }
    if (isIndiaCountry(country)) {
      res.status(400).json({
        error: "Indian buyers use the India path — no registration number needed",
      });
      return;
    }
    if (!reg || reg.length < 3) {
      res.status(400).json({ error: "Enter your company registration / trade licence number" });
      return;
    }
    if (!website) {
      res.status(400).json({ error: "Enter a valid company website" });
      return;
    }

    const email = dbUser.buyerCompanyEmail ?? "";
    const biz = validateBusinessEmail(email, website);
    if (!biz.ok) {
      res.status(400).json({ error: biz.error });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: dbUser.id },
      data: {
        buyerCountry: country,
        buyerRegistrationNumber: reg,
        buyerWebsite: website,
        buyerKycCompleted: true,
        buyerKycCompletedAt: new Date(),
        buyerEnabled: true,
        ...(dbUser.company ? {} : { company: website }),
      },
    });

    res.json({
      completed: true,
      user: jsonUser(updated),
      message: "Buyer verification complete — you can start sourcing",
    });
  },
);

export default router;
