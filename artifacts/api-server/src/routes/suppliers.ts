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
  ensureFreeSubscription,
  ensureUniqueSupplierSlug,
} from "../lib/shop";

const router: IRouter = Router();

function mapSupplier(s: Prisma.SupplierGetPayload<object>) {
  return {
    ...s,
    rating: toNumber(s.rating) ?? 0,
    responseRate: toNumber(s.responseRate),
    mainProducts: s.mainProducts ?? [],
    certifications: s.certifications ?? [],
    createdAt: s.createdAt.toISOString(),
    verifiedAt: s.verifiedAt ? s.verifiedAt.toISOString() : null,
  };
}

/** Public-safe card fields (no bank / GST secrets). */
function mapPublicSupplier(s: Prisma.SupplierGetPayload<object>) {
  return {
    id: s.id,
    slug: s.slug,
    companyName: s.companyName,
    description: s.description,
    location: s.location,
    country: s.country,
    city: s.city,
    state: s.state,
    logoUrl: s.logoUrl,
    coverUrl: s.coverUrl,
    videoUrl: s.videoUrl,
    shareImageUrl: s.shareImageUrl,
    verified: s.verified,
    yearsInBusiness: s.yearsInBusiness,
    employeeCount: s.employeeCount,
    mainProducts: s.mainProducts ?? [],
    certifications: s.certifications ?? [],
    rating: toNumber(s.rating) ?? 0,
    reviewCount: s.reviewCount,
    productCount: s.productCount,
    responseRate: toNumber(s.responseRate),
    responseTime: s.responseTime,
    website: s.website,
    createdAt: s.createdAt.toISOString(),
  };
}

router.get("/suppliers", requireClerkAuth, async (req, res): Promise<void> => {
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
      orderBy: [{ verified: "desc" }, { rating: "desc" }],
      take: limit,
      skip: (page - 1) * limit,
    }),
  ]);

  res.json({ items: items.map(mapSupplier), total, page, limit });
});

/** Shareable seller profile by slug — signed-in Karm users only. */
router.get("/suppliers/by-slug/:slug", requireClerkAuth, async (req, res): Promise<void> => {
  const slug = String(req.params.slug || "");
  const supplier = await prisma.supplier.findUnique({ where: { slug } });
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

router.get("/suppliers/featured", requireClerkAuth, async (_req, res): Promise<void> => {
  const items = await prisma.supplier.findMany({
    where: { verified: true },
    orderBy: { rating: "desc" },
    take: 8,
  });

  res.json(GetFeaturedSuppliersResponse.parse(items.map(mapSupplier)));
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
  // Always ensure a shareable slug exists so profile cards work after verification.
  if (!supplier.slug) {
    const slug = await ensureUniqueSupplierSlug(supplier.companyName, supplier.id);
    supplier = await prisma.supplier.update({
      where: { id: supplier.id },
      data: { slug },
    });
  }
  res.json({
    ...mapSupplier(supplier),
    gstLocked: supplier.verified || supplier.gstVerified,
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
  const gstLocked = existing.verified || existing.gstVerified;
  const incomingGst = readTrimmed(body.gstin);

  if (incomingGst) {
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
  const country = readTrimmed(body.country);
  if (country) patch.country = country;
  const description = readTrimmed(body.description);
  if (description !== undefined) patch.description = description || null;
  const contactPerson = readTrimmed(body.contactPerson);
  if (contactPerson !== undefined) patch.contactPerson = contactPerson || null;
  const contactPhone = readTrimmed(body.contactPhone);
  if (contactPhone !== undefined) {
    if (contactPhone && !/^[6-9]\d{9}$/.test(contactPhone)) {
      res.status(400).json({ error: "Enter a valid 10-digit Indian mobile number" });
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
    if (ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
      res.status(400).json({ error: "Valid IFSC code is required (e.g. HDFC0001234)" });
      return;
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
  }

  const updated = await prisma.supplier.update({
    where: { id: supplierId },
    data: patch,
  });
  res.json({
    ...mapSupplier(updated),
    gstLocked: updated.verified || updated.gstVerified,
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
    supplier: mapSupplier(updated),
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
  const slug =
    supplier.slug ?? (await ensureUniqueSupplierSlug(supplier.companyName, supplier.id));
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
 * Final submit validates GSTIN checksum and marks verified.
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
      const state = typeof data.state === "string" ? data.state.trim() : "";
      const legalName =
        typeof data.legalName === "string" ? data.legalName.trim() : "";
      if (!companyName || !(location || city)) {
        res.status(400).json({ error: "Company name and city / location are required" });
        return;
      }
      if (!businessAddress) {
        res.status(400).json({ error: "Registered business address is required" });
        return;
      }
      if (!state) {
        res.status(400).json({ error: "State is required" });
        return;
      }
      if (!legalName) {
        res.status(400).json({ error: "Legal entity name is required" });
        return;
      }
      const created = await prisma.supplier.create({
        data: {
          companyName,
          legalName,
          location: location || [city, state].filter(Boolean).join(", "),
          country:
            typeof data.country === "string" ? data.country.trim() || "India" : "India",
          city: city || null,
          state,
          pincode: typeof data.pincode === "string" ? data.pincode.trim() || null : null,
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
      res.json({ supplier: mapSupplier(withSlug), nextStep: 2 });
      return;
    }

    const existing = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!existing) {
      res.status(404).json({ error: "Supplier not found" });
      return;
    }
    if (existing.verified && existing.verificationStatus === "verified") {
      res.json({ supplier: mapSupplier(existing), nextStep: 5, alreadyVerified: true });
      return;
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
      const state = typeof data.state === "string" ? data.state.trim() : "";
      if (!companyName) {
        res.status(400).json({ error: "Company name is required" });
        return;
      }
      if (!businessAddress) {
        res.status(400).json({ error: "Registered business address is required" });
        return;
      }
      if (!city && !location) {
        res.status(400).json({ error: "City / location is required" });
        return;
      }
      if (!state) {
        res.status(400).json({ error: "State is required" });
        return;
      }
      patch.companyName = companyName;
      if (typeof data.legalName === "string") {
        const legal = data.legalName.trim();
        if (!legal) {
          res.status(400).json({ error: "Legal entity name is required" });
          return;
        }
        patch.legalName = legal;
      } else if (!existing.legalName) {
        res.status(400).json({ error: "Legal entity name is required" });
        return;
      }
      patch.location = location || [city, state].filter(Boolean).join(", ");
      patch.country =
        typeof data.country === "string" && data.country.trim()
          ? data.country.trim()
          : "India";
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
      if (!/^[6-9]\d{9}$/.test(contactPhone)) {
        res.status(400).json({ error: "Enter a valid 10-digit Indian mobile number" });
        return;
      }
      if (!contactEmail.includes("@")) {
        res.status(400).json({ error: "Valid contact email is required" });
        return;
      }
      patch.contactPerson = contactPerson;
      patch.contactPhone = contactPhone;
      patch.contactEmail = contactEmail;
      if (typeof data.website === "string") {
        patch.website = data.website.trim() || null;
      }
    }

    if (step === 3) {
      const gst = validateGstin(String(data.gstin ?? ""));
      if (!gst.ok) {
        res.status(400).json({ error: gst.error });
        return;
      }
      const clash = await prisma.supplier.findFirst({
        where: { gstin: gst.gstin, NOT: { id: supplierId } },
      });
      if (clash) {
        res.status(409).json({ error: "This GSTIN is already registered to another seller" });
        return;
      }
      patch.gstin = gst.gstin;
      patch.pan = gst.pan;
      patch.gstVerified = true;
      const stateName = GST_STATE_CODES[gst.stateCode];
      if (stateName && !existing.state) patch.state = stateName;
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
      if (!bankIfsc || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankIfsc)) {
        res.status(400).json({ error: "Valid IFSC code is required (e.g. HDFC0001234)" });
        return;
      }
      patch.bankAccountName = bankAccountName;
      patch.bankIfsc = bankIfsc;
      if (Array.isArray(data.certifications)) {
        patch.certifications = data.certifications.filter(
          (x): x is string => typeof x === "string" && x.trim().length > 0,
        );
      }
    }

    if (submit || step === 5) {
      // Final gate: require GST + company + contact
      const preview = { ...existing, ...Object.fromEntries(
        Object.entries(patch).map(([k, v]) => [k, v]),
      ) } as typeof existing;

      const gstin = (patch.gstin as string | undefined) ?? existing.gstin;
      const gst = validateGstin(gstin ?? "");
      if (!gst.ok) {
        res.status(400).json({
          error: "Valid GSTIN is required before verification. Complete the GST step.",
        });
        return;
      }
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
      void preview;
      patch.gstin = gst.gstin;
      patch.pan = gst.pan;
      patch.gstVerified = true;
      patch.verified = true;
      patch.verificationStatus = "verified";
      patch.verificationStep = 5;
      patch.verifiedAt = new Date();
      if (!existing.slug) {
        patch.slug = await ensureUniqueSupplierSlug(existing.companyName, supplierId);
      }
    } else {
      patch.verificationStatus = "draft";
      patch.verificationStep = Math.min(5, Math.max(step + 1, existing.verificationStep));
    }

    const updated = await prisma.supplier.update({
      where: { id: supplierId },
      data: patch,
    });
    if (updated.verified) {
      await ensureFreeSubscription(updated.id);
    }

    res.json({
      supplier: mapSupplier(updated),
      nextStep: updated.verified ? 5 : updated.verificationStep,
      verified: updated.verified,
      shareUrl: updated.slug ? `/s/${updated.slug}` : null,
    });
  },
);

router.get("/suppliers/:id", requireClerkAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetSupplierParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const supplier = await prisma.supplier.findUnique({ where: { id: params.data.id } });
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
      ...mapSupplier(withSlug),
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
  res.json(UpdateSupplierResponse.parse(mapSupplier(supplier)));
});

export default router;
