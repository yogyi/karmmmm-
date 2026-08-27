import { Router, type IRouter } from "express";
import { prisma, toNumber, type Prisma } from "@workspace/db";
import {
  CreateSupplierBody,
  UpdateSupplierBody,
  UpdateSupplierParams,
  GetSupplierParams,
  GetSupplierResponse,
  UpdateSupplierResponse,
  GetFeaturedSuppliersResponse,
  ListSuppliersQueryParams,
} from "@workspace/api-zod";
import { requireClerkAuth } from "../lib/auth";
import {
  canAccessSupplier,
  getAuthenticatedDbUser,
  isAdmin,
  isSellerOrAdmin,
  parseLinkedSupplierId,
} from "../lib/authorize";
import { GST_STATE_CODES, validateGstin } from "../lib/gstin";
import {
  gstLegalNameMatches,
  isGstLiveVerifyConfigured,
  verifyGstinLive,
} from "../lib/gstVerifyApi";
import { isIndiaCountry, isValidContactPhone } from "../lib/country";
import { validateBusinessEmail } from "../lib/businessEmail";
import {
  canonicalState,
  firstCompanyProfileError,
} from "../lib/companyProfile";
import {
  generateEmailOtp,
  hashEmailOtp,
  otpExpiresAt,
  otpResendAllowed,
  verifyEmailOtpHash,
} from "../lib/emailOtp";
import { sendMail } from "../lib/mail";
import { rateLimit } from "../lib/rateLimit";
import {
  checkUsernameAvailability,
  ensureFreeSubscription,
  ensureUniqueSupplierSlug,
  isLegacyIdSlug,
  resolveShareableSlug,
} from "../lib/shop";
import {
  PUBLIC_SUPPLIER_SELECT,
  mapOwnerSupplier,
  mapPublicSupplier,
} from "../lib/supplierDto";

const router: IRouter = Router();

router.get("/suppliers", async (req, res): Promise<void> => {
  const parsed = ListSuppliersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { search, verified, page = 1, limit = 20 } = parsed.data;

  const where: Prisma.SupplierWhereInput = {};
  if (search) where.companyName = { contains: search, mode: "insensitive" };
  if (verified !== undefined && verified !== null) where.verified = verified;

  const [total, items] = await Promise.all([
    prisma.supplier.count({ where }),
    prisma.supplier.findMany({
      where,
      select: PUBLIC_SUPPLIER_SELECT,
      orderBy: [{ verified: "desc" }, { rating: "desc" }],
      take: limit,
      skip: (page - 1) * limit,
    }),
  ]);

  res.json({ items: items.map(mapPublicSupplier), total, page, limit });
});

/** Shareable seller profile by slug — signed-in Karm users only. */
router.get("/suppliers/by-slug/:slug", requireClerkAuth, async (req, res): Promise<void> => {
  const slug = String(req.params.slug || "");
  const supplier = await prisma.supplier.findUnique({
    where: { slug },
    select: {
      ...PUBLIC_SUPPLIER_SELECT,
      verificationStatus: true,
    },
  });
  if (!supplier) {
    res.status(404).json({ error: "Supplier not found" });
    return;
  }
  // Draft KYC shops keep an internal slug but are not publicly shareable yet.
  const shareReady =
    supplier.verified === true ||
    supplier.verificationStatus === "pending" ||
    supplier.verificationStatus === "verified";
  if (!shareReady) {
    res.status(404).json({ error: "Supplier profile is not available yet" });
    return;
  }
  const { verificationStatus: _verificationStatus, ...publicFields } = supplier;
  const products = await prisma.product.findMany({
    where: { supplierId: supplier.id, inStock: true },
    orderBy: { createdAt: "desc" },
    take: 6,
  });
  res.json({
    supplier: mapPublicSupplier(publicFields),
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      imageUrl: p.imageUrl,
      minPrice: toNumber(p.minPrice),
      maxPrice: toNumber(p.maxPrice),
      unit: p.unit,
      minOrder: p.minOrder,
    })),
    shareUrl: `/s/${supplier.slug}`,
  });
});

router.get("/suppliers/featured", async (_req, res): Promise<void> => {
  const items = await prisma.supplier.findMany({
    where: { verified: true },
    select: PUBLIC_SUPPLIER_SELECT,
    orderBy: { rating: "desc" },
    take: 8,
  });

  res.json(GetFeaturedSuppliersResponse.parse(items.map(mapPublicSupplier)));
});

/** Linked shop for the authenticated seller (verification wizard). */
router.get("/suppliers/me", requireClerkAuth, async (req, res): Promise<void> => {
  const dbUser = await getAuthenticatedDbUser(req);
  if (!dbUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const supplierId = parseLinkedSupplierId(dbUser);
  if (supplierId == null) {
    res.status(404).json({ error: "No supplier profile linked yet" });
    return;
  }
  let supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) {
    res.status(404).json({ error: "Supplier not found" });
    return;
  }
  // Always ensure a clean shareable slug (upgrades legacy name-{id} links).
  const desiredSlug = await resolveShareableSlug(
    supplier.companyName,
    supplier.id,
    supplier.slug,
  );
  if (supplier.slug !== desiredSlug) {
    supplier = await prisma.supplier.update({
      where: { id: supplier.id },
      data: { slug: desiredSlug },
    });
  }

  // Optional Instagram-style username availability check on the same auth'd route.
  const checkRaw =
    typeof req.query.checkUsername === "string"
      ? req.query.checkUsername
      : typeof req.query.username === "string"
        ? req.query.username
        : "";
  let usernameCheck: Awaited<ReturnType<typeof checkUsernameAvailability>> | undefined;
  if (checkRaw.trim()) {
    try {
      usernameCheck = await checkUsernameAvailability(checkRaw, supplierId);
    } catch (err) {
      req.log?.error({ err }, "username check failed");
      usernameCheck = {
        username: checkRaw.trim().toLowerCase() || null,
        available: false,
        error: "Could not check username — try again",
        suggestions: [],
      };
    }
  }

  res.json({
    ...mapOwnerSupplier(supplier),
    username: supplier.slug,
    gstLocked: supplier.verified || supplier.gstVerified || supplier.verificationStatus === "pending",
    shareUrl: supplier.slug ? `/s/${supplier.slug}` : null,
    ...(usernameCheck ? { usernameCheck } : {}),
  });
});

/** Check whether a share username is available; returns alternatives if taken. */
router.get("/suppliers/me/username/check", requireClerkAuth, async (req, res): Promise<void> => {
  try {
    const dbUser = await getAuthenticatedDbUser(req);
    if (!dbUser) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (!isSellerOrAdmin(dbUser)) {
      res.status(403).json({ error: "Forbidden — sellers only" });
      return;
    }
    const supplierId = parseLinkedSupplierId(dbUser);
    const raw = typeof req.query.username === "string" ? req.query.username : "";
    const result = await checkUsernameAvailability(raw, supplierId);
    res.json(result);
  } catch (err) {
    req.log?.error({ err }, "username check failed");
    res.status(500).json({ error: "Could not check username — try again" });
  }
});

function readTrimmed(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.trim();
}

/** KYC document URL from private upload finalize (/api/storage/… or Blob https). */
function readKycDocumentUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const url = raw.trim();
  if (!url || url.length > 2048) return null;
  if (
    !url.startsWith("/api/storage/") &&
    !url.startsWith("https://") &&
    !url.startsWith("http://")
  ) {
    return null;
  }
  return url;
}

/** Logo / cover / share-card image URLs (storage path or absolute http(s)). */
function parseMediaUrl(
  value: unknown,
): { ok: true; url: string | null } | { ok: false; error: string } | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return { ok: true, url: null };
  if (typeof value !== "string") {
    return { ok: false, error: "Image URL must be a string" };
  }
  const url = value.trim();
  if (
    !url.startsWith("/api/storage/") &&
    !url.startsWith("https://") &&
    !url.startsWith("http://")
  ) {
    return { ok: false, error: "Invalid image URL" };
  }
  return { ok: true, url: url.slice(0, 500) };
}

/** Update shop profile after verification. GSTIN is locked unless re-verify is started. */
router.patch("/suppliers/me", requireClerkAuth, async (req, res): Promise<void> => {
  const dbUser = await getAuthenticatedDbUser(req);
  if (!dbUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (!isSellerOrAdmin(dbUser)) {
    res.status(403).json({ error: "Forbidden — sellers only" });
    return;
  }
  const supplierId = parseLinkedSupplierId(dbUser);
  if (supplierId == null) {
    res.status(404).json({ error: "No supplier profile linked yet" });
    return;
  }
  const existing = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!existing) {
    res.status(404).json({ error: "Supplier not found" });
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const gstLocked =
    existing.verified ||
    existing.gstVerified ||
    existing.verificationStatus === "pending";
  const incomingGst = readTrimmed(body.gstin);
  const countryUpdate = readTrimmed(body.country);
  const effectiveCountry = countryUpdate ?? existing.country ?? "India";
  const india = isIndiaCountry(effectiveCountry);

  if (incomingGst && india) {
    const gst = validateGstin(incomingGst);
    if (!gst.ok) {
      res.status(400).json({ error: gst.error });
      return;
    }
    if (gstLocked && gst.gstin !== existing.gstin) {
      res.status(409).json({
        error:
          "GSTIN is locked after verification. Start GST re-verification to change it.",
        code: "GST_LOCKED",
      });
      return;
    }
  }

  const patch: Prisma.SupplierUpdateInput = {};
  const usernameRaw =
    readTrimmed(body.username) ?? readTrimmed(body.slug);
  if (usernameRaw !== undefined) {
    const availability = await checkUsernameAvailability(usernameRaw, supplierId);
    if (!availability.available || !availability.username) {
      res.status(409).json({
        error: availability.error || "Username is taken",
        code: "USERNAME_TAKEN",
        username: availability.username,
        suggestions: availability.suggestions,
      });
      return;
    }
    patch.slug = availability.username;
  }
  const companyName = readTrimmed(body.companyName);
  if (companyName) patch.companyName = companyName;
  const legalName = readTrimmed(body.legalName);
  if (legalName !== undefined) patch.legalName = legalName || null;
  const businessAddress = readTrimmed(body.businessAddress);
  if (businessAddress !== undefined) patch.businessAddress = businessAddress || null;
  const city = readTrimmed(body.city);
  if (city !== undefined) patch.city = city || null;
  const state = readTrimmed(body.state);
  if (state !== undefined) patch.state = state || null;
  const pincode = readTrimmed(body.pincode);
  if (pincode !== undefined) patch.pincode = pincode || null;
  if (countryUpdate) {
    patch.country = countryUpdate;
    if (!isIndiaCountry(countryUpdate) && isIndiaCountry(existing.country)) {
      // Left India — drop GSTIN/PAN so foreign rules apply.
      patch.gstin = null;
      patch.pan = null;
      patch.gstVerified = false;
    }
  }
  const description = readTrimmed(body.description);
  if (description !== undefined) patch.description = description || null;
  const contactPerson = readTrimmed(body.contactPerson);
  if (contactPerson !== undefined) patch.contactPerson = contactPerson || null;
  const contactPhone = readTrimmed(body.contactPhone);
  if (contactPhone !== undefined) {
    if (contactPhone && !isValidContactPhone(contactPhone, effectiveCountry)) {
      res.status(400).json({
        error: india
          ? "Enter a valid 10-digit Indian mobile number"
          : "Enter a valid international phone (8–15 digits, + allowed)",
      });
      return;
    }
    patch.contactPhone = contactPhone || null;
  }
  const contactEmail = readTrimmed(body.contactEmail);
  if (contactEmail !== undefined) patch.contactEmail = contactEmail || null;
  const website = readTrimmed(body.website);
  if (website !== undefined) patch.website = website || null;
  const bankAccountName = readTrimmed(body.bankAccountName);
  if (bankAccountName !== undefined) patch.bankAccountName = bankAccountName || null;
  const bankIfsc = readTrimmed(body.bankIfsc);
  if (bankIfsc !== undefined) {
    const ifsc = bankIfsc.toUpperCase();
    if (ifsc) {
      if (india && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
        res.status(400).json({ error: "Valid IFSC code is required (e.g. HDFC0001234)" });
        return;
      }
      if (!india && !/^[A-Z0-9]{8,11}$/.test(ifsc.replace(/\s/g, ""))) {
        res.status(400).json({
          error: "Bank code should look like a SWIFT/BIC (8–11 characters) if provided",
        });
        return;
      }
    }
    patch.bankIfsc = ifsc || null;
  }
  if (body.yearsInBusiness != null && body.yearsInBusiness !== "") {
    patch.yearsInBusiness = Number(body.yearsInBusiness);
  }
  const employeeCount = readTrimmed(body.employeeCount);
  if (employeeCount !== undefined) patch.employeeCount = employeeCount || null;
  if (Array.isArray(body.mainProducts)) {
    patch.mainProducts = body.mainProducts.filter(
      (x): x is string => typeof x === "string" && x.trim().length > 0,
    );
  }
  if (Array.isArray(body.certifications)) {
    patch.certifications = body.certifications.filter(
      (x): x is string => typeof x === "string" && x.trim().length > 0,
    );
  }

  const logoUrl = parseMediaUrl(body.logoUrl);
  if (logoUrl !== undefined) {
    if (!logoUrl.ok) {
      res.status(400).json({ error: logoUrl.error });
      return;
    }
    patch.logoUrl = logoUrl.url;
  }
  const coverUrl = parseMediaUrl(body.coverUrl);
  if (coverUrl !== undefined) {
    if (!coverUrl.ok) {
      res.status(400).json({ error: coverUrl.error });
      return;
    }
    patch.coverUrl = coverUrl.url;
  }
  const shareImageUrl = parseMediaUrl(body.shareImageUrl);
  if (shareImageUrl !== undefined) {
    if (!shareImageUrl.ok) {
      res.status(400).json({ error: shareImageUrl.error });
      return;
    }
    patch.shareImageUrl = shareImageUrl.url;
  }

  if (city !== undefined || state !== undefined) {
    const nextCity = city !== undefined ? city : existing.city;
    const nextState = state !== undefined ? state : existing.state;
    patch.location = [nextCity, nextState].filter(Boolean).join(", ") || existing.location;
  }

  if (incomingGst && !gstLocked) {
    if (india) {
      const gst = validateGstin(incomingGst);
      if (gst.ok) {
        const clash = await prisma.supplier.findFirst({
          where: { gstin: gst.gstin, NOT: { id: supplierId } },
        });
        if (clash) {
          res.status(409).json({ error: "This GSTIN is already registered to another seller" });
          return;
        }
        patch.gstin = gst.gstin;
        patch.pan = gst.pan;
      }
    } else {
      patch.gstin = incomingGst.slice(0, 32) || null;
      patch.pan = null;
    }
  }

  const updated = await prisma.supplier.update({
    where: { id: supplierId },
    data: patch,
  });
  res.json({
    ...mapOwnerSupplier(updated),
    username: updated.slug,
    gstLocked:
      updated.verified ||
      updated.gstVerified ||
      updated.verificationStatus === "pending",
    shareUrl: updated.slug ? `/s/${updated.slug}` : null,
  });
});

/** Drop verified badge so the seller can change GSTIN and complete KYC again. */
router.post("/suppliers/me/reverify-gst", requireClerkAuth, async (req, res): Promise<void> => {
  const dbUser = await getAuthenticatedDbUser(req);
  if (!dbUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (!isSellerOrAdmin(dbUser)) {
    res.status(403).json({ error: "Forbidden — sellers only" });
    return;
  }
  const supplierId = parseLinkedSupplierId(dbUser);
  if (supplierId == null) {
    res.status(404).json({ error: "No supplier profile linked yet" });
    return;
  }
  const existing = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!existing) {
    res.status(404).json({ error: "Supplier not found" });
    return;
  }

  const updated = await prisma.supplier.update({
    where: { id: supplierId },
    data: {
      verified: false,
      gstVerified: false,
      verificationStatus: "draft",
      verificationStep: 3,
      verifiedAt: null,
    },
  });

  res.json({
    supplier: mapOwnerSupplier(updated),
    next: "/seller/verify?step=3",
    message: "Verified badge paused. Confirm your GSTIN to get verified again.",
  });
});

/** Create or refresh the public shareable profile link for the seller shop. */
router.post("/suppliers/me/share-link", requireClerkAuth, async (req, res): Promise<void> => {
  const dbUser = await getAuthenticatedDbUser(req);
  if (!dbUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (!isSellerOrAdmin(dbUser)) {
    res.status(403).json({ error: "Forbidden — sellers only" });
    return;
  }
  const supplierId = parseLinkedSupplierId(dbUser);
  if (supplierId == null) {
    res.status(404).json({ error: "Complete seller verification first to get a shareable profile" });
    return;
  }
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) {
    res.status(404).json({ error: "Supplier not found" });
    return;
  }
  const shareReady =
    supplier.verified === true ||
    supplier.verificationStatus === "pending" ||
    supplier.verificationStatus === "verified";
  if (!shareReady) {
    res.status(403).json({ error: "Complete seller verification first to get a shareable profile" });
    return;
  }
  const slug = await resolveShareableSlug(
    supplier.companyName,
    supplier.id,
    supplier.slug,
  );
  const updated =
    supplier.slug === slug
      ? supplier
      : await prisma.supplier.update({
          where: { id: supplier.id },
          data: { slug },
        });
  res.json({
    slug: updated.slug,
    shareUrl: `/s/${updated.slug}`,
    companyName: updated.companyName,
    verified: updated.verified,
  });
});

/**
 * Multi-step seller verification.
 * Body: { step: 1|2|3|4|5, data: {...}, submit?: boolean }
 * Final submit validates GSTIN format/checksum and queues for admin review —
 * checksum alone never grants the verified badge.
 */
router.post(
  "/suppliers/me/verification",
  requireClerkAuth,
  async (req, res): Promise<void> => {
    const dbUser = await getAuthenticatedDbUser(req);
    if (!dbUser) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (!isSellerOrAdmin(dbUser)) {
      res.status(403).json({ error: "Forbidden — sellers only" });
      return;
    }

    const body = req.body as {
      step?: number;
      submit?: boolean;
      data?: Record<string, unknown>;
    };
    const step = Number(body.step ?? 1);
    const data = body.data ?? {};
    const submit = body.submit === true;

    let supplierId = parseLinkedSupplierId(dbUser);

    // Step 1 can create the shop if missing.
    if (supplierId == null) {
      if (step !== 1) {
        res.status(400).json({ error: "Complete company profile first (step 1)" });
        return;
      }
      const companyName =
        typeof data.companyName === "string" ? data.companyName.trim() : "";
      const location =
        typeof data.location === "string" ? data.location.trim() : "";
      const businessAddress =
        typeof data.businessAddress === "string" ? data.businessAddress.trim() : "";
      const city = typeof data.city === "string" ? data.city.trim() : "";
      const stateRaw = typeof data.state === "string" ? data.state.trim() : "";
      const legalName =
        typeof data.legalName === "string" ? data.legalName.trim() : "";
      const nextCountry =
        typeof data.country === "string" ? data.country.trim() || "India" : "India";
      const pincode =
        typeof data.pincode === "string" ? data.pincode.trim() : "";

      const profileErr = firstCompanyProfileError({
        companyName,
        legalName,
        businessAddress,
        city: city || location.split(",")[0]?.trim() || "",
        state: stateRaw,
        pincode,
        country: nextCountry,
        location,
        yearsInBusiness:
          data.yearsInBusiness != null && data.yearsInBusiness !== ""
            ? String(data.yearsInBusiness)
            : undefined,
      });
      if (profileErr) {
        res.status(400).json({ error: profileErr });
        return;
      }
      const state = canonicalState(stateRaw, nextCountry);
      const created = await prisma.supplier.create({
        data: {
          companyName,
          legalName,
          location: location || [city, state].filter(Boolean).join(", "),
          country: nextCountry,
          city: city || null,
          state,
          pincode: pincode || null,
          businessAddress,
          description:
            typeof data.description === "string" ? data.description.trim() || null : null,
          yearsInBusiness:
            typeof data.yearsInBusiness === "number"
              ? data.yearsInBusiness
              : typeof data.yearsInBusiness === "string" && data.yearsInBusiness
                ? parseInt(data.yearsInBusiness, 10)
                : null,
          employeeCount:
            typeof data.employeeCount === "string"
              ? data.employeeCount.trim() || null
              : null,
          mainProducts: Array.isArray(data.mainProducts)
            ? data.mainProducts.filter((x): x is string => typeof x === "string")
            : [],
          verificationStatus: "draft",
          verificationStep: 2,
          verified: false,
        },
      });
      const slug = await ensureUniqueSupplierSlug(companyName, created.id);
      const withSlug = await prisma.supplier.update({
        where: { id: created.id },
        data: { slug },
      });
      await prisma.user.update({
        where: { id: dbUser.id },
        data: { supplierId: created.id, role: "seller", sellerEnabled: true },
      });
      await ensureFreeSubscription(created.id);
      res.json({ supplier: mapOwnerSupplier(withSlug), nextStep: 2 });
      return;
    }

    const existing = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!existing) {
      res.status(404).json({ error: "Supplier not found" });
      return;
    }
    if (existing.verified && existing.verificationStatus === "verified") {
      res.json({ supplier: mapOwnerSupplier(existing), nextStep: 5, alreadyVerified: true });
      return;
    }
    if (existing.verificationStatus === "pending" && !submit && step !== 1) {
      // Allow reading progress; block duplicate submits until admin acts or reverify.
      if (step >= 3) {
        res.json({
          supplier: mapOwnerSupplier(existing),
          nextStep: 5,
          pendingReview: true,
          message: "GSTIN is awaiting Karm Baba review. Verified badge is not active yet.",
        });
        return;
      }
    }

    const patch: Prisma.SupplierUpdateInput = {
      verificationStep: Math.max(step + (submit ? 0 : 1), existing.verificationStep),
    };

    if (step === 1) {
      const companyName =
        typeof data.companyName === "string" ? data.companyName.trim() : "";
      const location =
        typeof data.location === "string" ? data.location.trim() : "";
      const businessAddress =
        typeof data.businessAddress === "string" ? data.businessAddress.trim() : "";
      const city = typeof data.city === "string" ? data.city.trim() : "";
      const stateRaw = typeof data.state === "string" ? data.state.trim() : "";
      const pincode =
        typeof data.pincode === "string" ? data.pincode.trim() : existing.pincode ?? "";
      const nextCountry =
        typeof data.country === "string" && data.country.trim()
          ? data.country.trim()
          : "India";
      const legalName =
        typeof data.legalName === "string"
          ? data.legalName.trim()
          : existing.legalName ?? "";

      const profileErr = firstCompanyProfileError({
        companyName,
        legalName,
        businessAddress,
        city: city || location.split(",")[0]?.trim() || "",
        state: stateRaw,
        pincode: typeof pincode === "string" ? pincode : "",
        country: nextCountry,
        location,
        yearsInBusiness:
          data.yearsInBusiness != null && data.yearsInBusiness !== ""
            ? String(data.yearsInBusiness)
            : undefined,
      });
      if (profileErr) {
        res.status(400).json({ error: profileErr });
        return;
      }

      const state = canonicalState(stateRaw, nextCountry);
      patch.companyName = companyName;
      patch.legalName = legalName;
      patch.location = location || [city, state].filter(Boolean).join(", ");
      patch.country = nextCountry;
      if (!isIndiaCountry(nextCountry) && isIndiaCountry(existing.country)) {
        patch.gstin = null;
        patch.pan = null;
        patch.gstVerified = false;
      }
      patch.city = city || null;
      patch.state = state;
      patch.pincode =
        typeof data.pincode === "string" ? data.pincode.trim() || null : existing.pincode;
      patch.businessAddress = businessAddress;
      if (typeof data.description === "string") {
        patch.description = data.description.trim() || null;
      }
      if (data.yearsInBusiness != null && data.yearsInBusiness !== "") {
        patch.yearsInBusiness = Number(data.yearsInBusiness);
      }
      if (typeof data.employeeCount === "string") {
        patch.employeeCount = data.employeeCount.trim() || null;
      }
      if (Array.isArray(data.mainProducts)) {
        patch.mainProducts = data.mainProducts.filter(
          (x): x is string => typeof x === "string" && x.trim().length > 0,
        );
      }
    }

    if (step === 2) {
      const contactPerson =
        typeof data.contactPerson === "string" ? data.contactPerson.trim() : "";
      const contactPhone =
        typeof data.contactPhone === "string" ? data.contactPhone.trim() : "";
      const contactEmail =
        typeof data.contactEmail === "string" ? data.contactEmail.trim() : "";
      if (!contactPerson) {
        res.status(400).json({ error: "Contact person is required" });
        return;
      }
      const countryForPhone =
        (typeof patch.country === "string" ? patch.country : null) ??
        existing.country ??
        "India";
      if (!isValidContactPhone(contactPhone, countryForPhone)) {
        res.status(400).json({
          error: isIndiaCountry(countryForPhone)
            ? "Enter a valid 10-digit Indian mobile number"
            : "Enter a valid international phone (8–15 digits, + allowed)",
        });
        return;
      }
      if (!contactEmail.includes("@")) {
        res.status(400).json({ error: "Valid contact email is required" });
        return;
      }
      const countryForEmail = countryForPhone;
      const site =
        typeof data.website === "string"
          ? data.website.trim() || null
          : existing.website;
      if (typeof data.website === "string") {
        patch.website = site;
      }
      if (!isIndiaCountry(countryForEmail)) {
        const biz = validateBusinessEmail(contactEmail, site);
        if (!biz.ok) {
          res.status(400).json({ error: biz.error });
          return;
        }
        patch.contactEmail = biz.email;
        if (existing.contactEmail?.toLowerCase() !== biz.email) {
          patch.businessEmailVerified = false;
          patch.businessEmailOtpHash = null;
          patch.businessEmailOtpExpiresAt = null;
        }
      } else {
        patch.contactEmail = contactEmail;
      }
      patch.contactPerson = contactPerson;
      patch.contactPhone = contactPhone;
    }

    if (step === 3) {
      const country =
        (typeof patch.country === "string" ? patch.country : null) ??
        existing.country ??
        "India";
      if (isIndiaCountry(country)) {
        const gst = validateGstin(String(data.gstin ?? ""));
        if (!gst.ok) {
          res.status(400).json({ error: gst.error });
          return;
        }
        const clash = await prisma.supplier.findFirst({
          where: { gstin: gst.gstin, NOT: { id: supplierId } },
        });
        if (clash) {
          res.status(409).json({
            error: "This GSTIN is already registered to another seller",
          });
          return;
        }
        patch.gstin = gst.gstin;
        patch.pan = gst.pan;
        patch.gstVerified = false;
        const aadhaarUrl = readKycDocumentUrl(data.aadhaarDocumentUrl);
        if (!aadhaarUrl) {
          res.status(400).json({
            error: "Upload your Aadhaar card (JPEG, PNG, or PDF) before continuing",
          });
          return;
        }
        patch.aadhaarDocumentUrl = aadhaarUrl;

          if (isGstLiveVerifyConfigured()) {
          const live = await verifyGstinLive(gst.gstin);
          if (!live.ok) {
            res.status(live.httpStatus && live.httpStatus >= 400 && live.httpStatus < 500
              ? live.httpStatus
              : 400).json({ error: live.error });
            return;
          }
          const registeredState = (existing.state ?? "").trim();
          if (registeredState) {
            const expectedName = GST_STATE_CODES[gst.stateCode];
            const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
            if (
              expectedName &&
              norm(registeredState) !== norm(expectedName) &&
              live.record.state &&
              norm(registeredState) !== norm(live.record.state)
            ) {
              res.status(400).json({
                error: `GSTIN belongs to ${live.record.state ?? expectedName}, but company profile state is ${registeredState}`,
              });
              return;
            }
          }
          const formLegal =
            typeof data.legalName === "string" && data.legalName.trim()
              ? data.legalName.trim()
              : existing.legalName ?? "";
          if (formLegal && !gstLegalNameMatches(formLegal, live.record.legalName)) {
            res.status(400).json({
              error:
                "Legal entity name does not match GST records. Use the name on your GST certificate.",
              gstLegalName: live.record.legalName,
            });
            return;
          }
          patch.gstin = live.record.gstin;
          patch.pan = live.record.pan ?? gst.pan;
          patch.gstLiveStatus = live.record.status;
          patch.gstLiveVerifiedAt = new Date();
          patch.gstTradeName = live.record.tradeName;
          if (live.record.state && !existing.state) {
            patch.state = live.record.state;
          }
        } else {
          const stateName = GST_STATE_CODES[gst.stateCode];
          if (stateName && !existing.state) patch.state = stateName;
        }
      } else {
        // Overseas step 3: business registration (email OTP verified on step 2).
        if (!existing.businessEmailVerified) {
          res.status(400).json({
            error:
              "Verify your company-domain email with OTP on the Contact step before continuing",
          });
          return;
        }
        const regUrl = readKycDocumentUrl(data.businessRegistrationDocumentUrl);
        if (!regUrl) {
          res.status(400).json({
            error: "Upload your business registration document before continuing",
          });
          return;
        }
        const regNum =
          typeof data.businessRegistrationNumber === "string"
            ? data.businessRegistrationNumber.trim().slice(0, 64)
            : "";
        if (!regNum) {
          res.status(400).json({
            error: "Registration / licence number is required",
          });
          return;
        }
        patch.businessRegistrationDocumentUrl = regUrl;
        patch.businessRegistrationNumber = regNum;
      }
    }

    if (step === 4) {
      const country =
        (typeof patch.country === "string" ? patch.country : null) ??
        existing.country ??
        "India";
      if (isIndiaCountry(country)) {
      const bankAccountName =
        typeof data.bankAccountName === "string" ? data.bankAccountName.trim() : "";
      const bankIfsc =
        typeof data.bankIfsc === "string" ? data.bankIfsc.trim().toUpperCase() : "";
      if (!bankAccountName) {
        res.status(400).json({ error: "Account holder name is required" });
        return;
      }
        if (!bankIfsc || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankIfsc)) {
          res.status(400).json({
            error: "Valid IFSC code is required (e.g. HDFC0001234)",
          });
          return;
        }
        patch.bankIfsc = bankIfsc;
        patch.bankAccountName = bankAccountName;
        if (Array.isArray(data.certifications)) {
          patch.certifications = data.certifications.filter(
            (x): x is string => typeof x === "string" && x.trim().length > 0,
          );
        }
      } else {
        const taxId =
          typeof data.gstin === "string" ? data.gstin.trim().slice(0, 32) : "";
        if (!taxId || taxId.length < 2) {
          res.status(400).json({ error: "Tax ID is required for overseas sellers" });
          return;
        }
        patch.gstin = taxId;
        patch.pan = null;
        patch.gstVerified = false;
      }
    }

    if (submit || step === 5) {
      const contactPerson =
        (patch.contactPerson as string | null | undefined) ?? existing.contactPerson;
      const contactPhone =
        (patch.contactPhone as string | null | undefined) ?? existing.contactPhone;
      if (!contactPerson || !contactPhone) {
        res.status(400).json({
          error: "Contact person and phone are required before verification",
        });
        return;
      }

      const country =
        (typeof patch.country === "string" ? patch.country : null) ??
        existing.country ??
        "India";
      if (isIndiaCountry(country)) {
        const gstin = (patch.gstin as string | undefined) ?? existing.gstin;
        const gst = validateGstin(gstin ?? "");
        if (!gst.ok) {
          res.status(400).json({
            error: "Valid GSTIN is required before verification. Complete the GST step.",
          });
          return;
        }
        patch.gstin = gst.gstin;
        patch.pan = gst.pan;
        if (isGstLiveVerifyConfigured() && !existing.gstLiveVerifiedAt) {
          res.status(400).json({
            error: "Complete live GST verification on the GST step before submitting",
          });
          return;
        }
        if (!existing.aadhaarDocumentUrl) {
          res.status(400).json({
            error: "Upload your Aadhaar card on the GST step before submitting",
          });
          return;
        }
        const bankAccountName =
          (patch.bankAccountName as string | undefined) ?? existing.bankAccountName ?? "";
        const bankIfsc =
          (patch.bankIfsc as string | undefined) ?? existing.bankIfsc ?? "";
        if (!bankAccountName.trim()) {
          res.status(400).json({
            error: "Account holder name is required before verification. Complete the Bank step.",
          });
          return;
        }
        if (!bankIfsc.trim() || !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(bankIfsc.trim())) {
          res.status(400).json({
            error: "Valid IFSC code is required before verification. Complete the Bank step.",
          });
          return;
        }
      } else {
        if (!existing.businessEmailVerified) {
          res.status(400).json({
            error:
              "Verify your company-domain email with OTP before submitting (overseas KYC).",
          });
          return;
        }
        if (!existing.businessRegistrationDocumentUrl) {
          res.status(400).json({
            error: "Upload business registration on step 3 before submitting",
          });
          return;
        }
        if (!existing.businessRegistrationNumber?.trim()) {
          res.status(400).json({
            error: "Business registration number is required before submitting",
          });
          return;
        }
        const taxId = (patch.gstin as string | undefined) ?? existing.gstin ?? "";
        if (!taxId.trim() || taxId.trim().length < 2) {
          res.status(400).json({
            error: "Tax ID is required on step 4 before submitting",
          });
          return;
        }
        patch.gstVerified = false;
      }

      patch.verified = false;
      patch.verificationStatus = "pending";
      patch.verificationStep = 5;
      patch.verifiedAt = null;
      if (!existing.slug || isLegacyIdSlug(existing.slug, existing.companyName, supplierId)) {
        patch.slug = await resolveShareableSlug(
          existing.companyName,
          supplierId,
          existing.slug,
        );
      }
    } else {
      patch.verificationStatus = "draft";
      patch.verificationStep = Math.min(5, Math.max(step + 1, existing.verificationStep));
    }

    const updated = await prisma.supplier.update({
      where: { id: supplierId },
      data: patch,
    });
    // Free plan once profile is submitted (pending), not only when verified.
    if (updated.verificationStatus === "pending" || updated.verified) {
      await ensureFreeSubscription(updated.id);
    }

    const indiaSeller = isIndiaCountry(updated.country);
    res.json({
      supplier: mapOwnerSupplier(updated),
      nextStep: updated.verificationStatus === "pending" || updated.verified ? 5 : updated.verificationStep,
      verified: updated.verified,
      pendingReview: updated.verificationStatus === "pending",
      shareUrl: updated.slug ? `/s/${updated.slug}` : null,
      message:
        updated.verificationStatus === "pending"
          ? indiaSeller
            ? "Profile submitted. Verified badge appears after Karm Baba reviews your GSTIN."
            : "Profile submitted. Company email verified. Verified badge appears after Karm Baba reviews your company details."
          : undefined,
    });
  },
);

/** Live GSTIN lookup — persists verification on the supplier row. */
router.post(
  "/suppliers/me/verification/gst-verify",
  requireClerkAuth,
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 12,
    key: (req) => {
      const uid = (req as { clerkUserId?: string }).clerkUserId || "unknown";
      return `gst-verify:user:${uid}`;
    },
  }),
  async (req, res): Promise<void> => {
    const dbUser = await getAuthenticatedDbUser(req);
    if (!dbUser) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (!isSellerOrAdmin(dbUser)) {
      res.status(403).json({ error: "Forbidden — sellers only" });
      return;
    }
    const supplierId = parseLinkedSupplierId(dbUser);
    if (supplierId == null) {
      res.status(404).json({ error: "No supplier profile linked yet" });
      return;
    }
    const existing = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!existing) {
      res.status(404).json({ error: "Supplier not found" });
      return;
    }
    if (!isIndiaCountry(existing.country)) {
      res.status(400).json({ error: "Live GST verification is for Indian sellers only" });
      return;
    }
    if (!isGstLiveVerifyConfigured()) {
      res.status(503).json({
        error: "Live GST verification is not configured. Set GST_VERIFY_API_KEY on the server.",
      });
      return;
    }

    const body = req.body as { gstin?: string; legalName?: string };
    const gstinRaw = typeof body.gstin === "string" ? body.gstin : "";
    const legalName =
      typeof body.legalName === "string" && body.legalName.trim()
        ? body.legalName.trim()
        : existing.legalName ?? "";

    const live = await verifyGstinLive(gstinRaw);
    if (!live.ok) {
      res.status(live.httpStatus && live.httpStatus >= 400 && live.httpStatus < 500
        ? live.httpStatus
        : 400).json({ error: live.error });
      return;
    }

    const format = validateGstin(live.record.gstin);
    if (!format.ok) {
      res.status(400).json({ error: format.error });
      return;
    }

    const clash = await prisma.supplier.findFirst({
      where: { gstin: live.record.gstin, NOT: { id: supplierId } },
    });
    if (clash) {
      res.status(409).json({
        error: "This GSTIN is already registered to another seller",
      });
      return;
    }

    const nameMatches =
      !legalName || gstLegalNameMatches(legalName, live.record.legalName);
    if (!nameMatches) {
      res.status(400).json({
        error:
          "Legal entity name does not match GST records. Use the name on your GST certificate.",
        gstLegalName: live.record.legalName,
        nameMatches: false,
      });
      return;
    }

    const updated = await prisma.supplier.update({
      where: { id: supplierId },
      data: {
        gstin: live.record.gstin,
        pan: live.record.pan ?? format.pan,
        gstLiveStatus: live.record.status,
        gstLiveVerifiedAt: new Date(),
        gstTradeName: live.record.tradeName,
        ...(live.record.state && !existing.state ? { state: live.record.state } : {}),
      },
    });

    res.json({
      verified: true,
      cached: live.record.cached,
      nameMatches: true,
      record: {
        gstin: live.record.gstin,
        legalName: live.record.legalName,
        tradeName: live.record.tradeName,
        status: live.record.status,
        pan: live.record.pan,
        state: live.record.state,
        stateCode: live.record.stateCode,
        address: live.record.address,
        constitution: live.record.constitution,
        taxpayerType: live.record.taxpayerType,
        registrationDate: live.record.registrationDate,
      },
      supplier: mapOwnerSupplier(updated),
      message: "GSTIN verified with GSTN",
    });
  },
);

/** Overseas: send OTP to company-domain business email (GST substitute). */
router.post(
  "/suppliers/me/verification/email-otp",
  requireClerkAuth,
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 8,
    key: (req) => {
      const uid =
        (req as { clerkUserId?: string }).clerkUserId ||
        "unknown";
      return `email-otp:user:${uid}`;
    },
  }),
  async (req, res): Promise<void> => {
    const dbUser = await getAuthenticatedDbUser(req);
    if (!dbUser) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (!isSellerOrAdmin(dbUser)) {
      res.status(403).json({ error: "Forbidden — sellers only" });
      return;
    }
    const supplierId = parseLinkedSupplierId(dbUser);
    if (supplierId == null) {
      res.status(404).json({ error: "No supplier profile linked yet" });
      return;
    }
    const existing = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!existing) {
      res.status(404).json({ error: "Supplier not found" });
      return;
    }
    if (isIndiaCountry(existing.country)) {
      res.status(400).json({
        error: "Company-email OTP is for overseas sellers. Indian sellers use GSTIN.",
      });
      return;
    }
    if (!otpResendAllowed(existing.businessEmailOtpExpiresAt)) {
      res.status(429).json({
        error: "Wait about a minute before requesting another code",
      });
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const rawEmail =
      (typeof body.email === "string" && body.email.trim()) ||
      existing.contactEmail ||
      "";
    const biz = validateBusinessEmail(rawEmail, existing.website);
    if (!biz.ok) {
      res.status(400).json({ error: biz.error });
      return;
    }

    const code = generateEmailOtp();
    const hash = hashEmailOtp(code, biz.email);
    const expires = otpExpiresAt();

    await prisma.supplier.update({
      where: { id: supplierId },
      data: {
        contactEmail: biz.email,
        businessEmailVerified: false,
        businessEmailOtpHash: hash,
        businessEmailOtpExpiresAt: expires,
      },
    });

    const sent = await sendMail({
      to: biz.email,
      subject: "Your Karm Baba verification code",
      text: `Your Karm Baba seller verification code is ${code}.\n\nIt expires in 15 minutes.\n\nIf you did not request this, ignore this email.`,
      html: `<p>Your Karm Baba seller verification code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p><p>It expires in 15 minutes.</p>`,
    });
    if (!sent.ok) {
      res.status(502).json({ error: sent.error });
      return;
    }

    res.json({
      sent: true,
      email: biz.email,
      expiresAt: expires.toISOString(),
      ...(sent.mode === "dev-log" ? { previewCode: code } : {}),
      message:
        sent.mode === "dev-log"
          ? "Dev mode: OTP logged on server (and returned as previewCode)"
          : `Code sent to ${biz.email}`,
    });
  },
);

/** Overseas: confirm OTP for company-domain email. */
router.post(
  "/suppliers/me/verification/email-otp/confirm",
  requireClerkAuth,
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    key: (req) => {
      const uid = (req as { clerkUserId?: string }).clerkUserId || "unknown";
      return `email-otp-confirm:user:${uid}`;
    },
  }),
  async (req, res): Promise<void> => {
    const dbUser = await getAuthenticatedDbUser(req);
    if (!dbUser) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (!isSellerOrAdmin(dbUser)) {
      res.status(403).json({ error: "Forbidden — sellers only" });
      return;
    }
    const supplierId = parseLinkedSupplierId(dbUser);
    if (supplierId == null) {
      res.status(404).json({ error: "No supplier profile linked yet" });
      return;
    }
    const existing = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!existing) {
      res.status(404).json({ error: "Supplier not found" });
      return;
    }
    if (isIndiaCountry(existing.country)) {
      res.status(400).json({ error: "Company-email OTP is for overseas sellers only" });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!/^\d{6}$/.test(code)) {
      res.status(400).json({ error: "Enter the 6-digit code from your email" });
      return;
    }
    if (
      !existing.businessEmailOtpExpiresAt ||
      existing.businessEmailOtpExpiresAt.getTime() < Date.now()
    ) {
      res.status(400).json({ error: "Code expired — request a new one" });
      return;
    }
    const email = existing.contactEmail ?? "";
    if (!verifyEmailOtpHash(code, email, existing.businessEmailOtpHash)) {
      res.status(400).json({ error: "Incorrect code — check your email and try again" });
      return;
    }

    const updated = await prisma.supplier.update({
      where: { id: supplierId },
      data: {
        businessEmailVerified: true,
        businessEmailOtpHash: null,
        businessEmailOtpExpiresAt: null,
      },
    });

    res.json({
      verified: true,
      email: updated.contactEmail,
      supplier: mapOwnerSupplier(updated),
      message: "Company email verified",
    });
  },
);

/** Admin: grant verified badge after real GST / KYC review. */
router.post(
  "/suppliers/:id/approve-verification",
  requireClerkAuth,
  async (req, res): Promise<void> => {
    const dbUser = await getAuthenticatedDbUser(req);
    if (!dbUser || !isAdmin(dbUser)) {
      res.status(403).json({ error: "Admin only" });
      return;
    }
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(String(rawId), 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid supplier id" });
      return;
    }
    const existing = await prisma.supplier.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Supplier not found" });
      return;
    }
    const gst = validateGstin(existing.gstin ?? "");
    if (isIndiaCountry(existing.country) && !gst.ok) {
      res.status(400).json({ error: "Supplier has no valid GSTIN on file" });
      return;
    }
    const updated = await prisma.supplier.update({
      where: { id },
      data: {
        gstVerified: isIndiaCountry(existing.country) ? true : existing.gstVerified,
        verified: true,
        verificationStatus: "verified",
        verificationStep: 5,
        verifiedAt: new Date(),
        pan: existing.pan || (gst.ok ? gst.pan : existing.pan),
      },
    });
    await ensureFreeSubscription(updated.id);
    res.json({
      supplier: mapOwnerSupplier(updated),
      verified: true,
      message: "Supplier marked verified",
    });
  },
);

router.get("/suppliers/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetSupplierParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const supplier = await prisma.supplier.findUnique({
    where: { id: params.data.id },
    select: PUBLIC_SUPPLIER_SELECT,
  });
  if (!supplier) {
    res.status(404).json({ error: "Supplier not found" });
    return;
  }

  res.json(GetSupplierResponse.parse(mapPublicSupplier(supplier)));
});

router.post("/suppliers", requireClerkAuth, async (req, res): Promise<void> => {
  const parsed = CreateSupplierBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const dbUser = await getAuthenticatedDbUser(req);
  if (!dbUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (!isSellerOrAdmin(dbUser)) {
    res.status(403).json({ error: "Forbidden — only sellers can create supplier profiles" });
    return;
  }

  // Sellers may only create one linked shop (admins can create freely).
  if (!isAdmin(dbUser) && parseLinkedSupplierId(dbUser)) {
    res.status(409).json({ error: "Your account is already linked to a supplier profile" });
    return;
  }

  const supplier = await prisma.supplier.create({
    data: {
      ...parsed.data,
      mainProducts: parsed.data.mainProducts ?? [],
      certifications: parsed.data.certifications ?? [],
      rating: 0,
      verified: false,
    },
  });

  const slug = await ensureUniqueSupplierSlug(supplier.companyName, supplier.id);
  const withSlug = await prisma.supplier.update({
    where: { id: supplier.id },
    data: { slug },
  });
  await ensureFreeSubscription(supplier.id);

  if (!isAdmin(dbUser)) {
    await prisma.user.update({
      where: { id: dbUser.id },
      data: { supplierId: supplier.id, role: "seller", sellerEnabled: true },
    });
  }

  res.status(201).json(
    GetSupplierResponse.parse({
      ...mapOwnerSupplier(withSlug),
      responseRate: null,
    }),
  );
});

router.patch("/suppliers/:id", requireClerkAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateSupplierParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateSupplierBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const dbUser = await getAuthenticatedDbUser(req);
  if (!dbUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (!isSellerOrAdmin(dbUser)) {
    res.status(403).json({ error: "Forbidden — only sellers can update supplier profiles" });
    return;
  }
  if (!canAccessSupplier(dbUser, params.data.id)) {
    res.status(403).json({ error: "Forbidden — you can only update your linked supplier" });
    return;
  }

  const data: Prisma.SupplierUpdateInput = { ...parsed.data };
  // Only admins can toggle verification.
  if ("verified" in data && !isAdmin(dbUser)) {
    delete data.verified;
  }

  const existing = await prisma.supplier.findUnique({ where: { id: params.data.id } });
  if (!existing) {
    res.status(404).json({ error: "Supplier not found" });
    return;
  }

  const supplier = await prisma.supplier.update({
    where: { id: params.data.id },
    data,
  });
  res.json(UpdateSupplierResponse.parse(mapOwnerSupplier(supplier)));
});

export default router;
