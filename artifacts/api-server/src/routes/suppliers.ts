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
    select: PUBLIC_SUPPLIER_SELECT,
  });
  if (!supplier) {
    res.status(404).json({ error: "Supplier not found" });
    return;
  }
  const products = await prisma.product.findMany({
    where: { supplierId: supplier.id, inStock: true },
    orderBy: { createdAt: "desc" },
    take: 6,
  });
  res.json({
    supplier: mapPublicSupplier(supplier),
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
  res.json({
    ...mapOwnerSupplier(supplier),
    gstLocked: supplier.verified || supplier.gstVerified || supplier.verificationStatus === "pending",
    shareUrl: supplier.slug ? `/s/${supplier.slug}` : null,
  });
});

function readTrimmed(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.trim();
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
        data: { supplierId: created.id, role: "seller" },
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
        const stateName = GST_STATE_CODES[gst.stateCode];
        if (stateName && !existing.state) patch.state = stateName;
      } else {
        // Overseas: company-domain email OTP replaces GST. Tax ID optional.
        if (!existing.businessEmailVerified) {
          res.status(400).json({
            error:
              "Verify your company-domain email with the OTP we sent before continuing",
          });
          return;
        }
        const taxId =
          typeof data.gstin === "string" ? data.gstin.trim().slice(0, 32) : "";
        patch.gstin = taxId || null;
        patch.pan = null;
        patch.gstVerified = false;
      }
    }

    if (step === 4) {
      const bankAccountName =
        typeof data.bankAccountName === "string" ? data.bankAccountName.trim() : "";
      const bankIfsc =
        typeof data.bankIfsc === "string" ? data.bankIfsc.trim().toUpperCase() : "";
      if (!bankAccountName) {
        res.status(400).json({ error: "Account holder name is required" });
        return;
      }
      const country =
        (typeof patch.country === "string" ? patch.country : null) ??
        existing.country ??
        "India";
      if (isIndiaCountry(country)) {
        if (!bankIfsc || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankIfsc)) {
          res.status(400).json({
            error: "Valid IFSC code is required (e.g. HDFC0001234)",
          });
          return;
        }
        patch.bankIfsc = bankIfsc;
      } else {
        // SWIFT/BIC optional for foreign sellers
        if (bankIfsc && !/^[A-Z0-9]{8,11}$/.test(bankIfsc.replace(/\s/g, ""))) {
          res.status(400).json({
            error: "Bank code should look like a SWIFT/BIC (8–11 characters) if provided",
          });
          return;
        }
        patch.bankIfsc = bankIfsc || null;
      }
      patch.bankAccountName = bankAccountName;
      if (Array.isArray(data.certifications)) {
        patch.certifications = data.certifications.filter(
          (x): x is string => typeof x === "string" && x.trim().length > 0,
        );
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
      } else {
        if (!existing.businessEmailVerified) {
          res.status(400).json({
            error:
              "Verify your company-domain email with OTP before submitting (overseas KYC).",
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

/** Overseas: send OTP to company-domain business email (GST substitute). */
router.post(
  "/suppliers/me/verification/email-otp",
  requireClerkAuth,
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 8,
    key: (req) => {
      const ip =
        (typeof req.headers["x-forwarded-for"] === "string"
          ? req.headers["x-forwarded-for"].split(",")[0]?.trim()
          : undefined) ||
        req.ip ||
        "unknown";
      return `email-otp:${ip}`;
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
    max: 20,
    key: (req) => {
      const ip =
        (typeof req.headers["x-forwarded-for"] === "string"
          ? req.headers["x-forwarded-for"].split(",")[0]?.trim()
          : undefined) ||
        req.ip ||
        "unknown";
      return `email-otp-confirm:${ip}`;
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
      data: { supplierId: supplier.id, role: "seller" },
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
