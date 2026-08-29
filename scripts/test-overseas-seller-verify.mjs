#!/usr/bin/env node
/**
 * End-to-end overseas seller verification + Sendmator email OTP test.
 * Uses Clerk dev session for a seller account and hits local API.
 *
 *   node scripts/test-overseas-seller-verify.mjs
 *   CLERK_USER_ID=user_xxx node scripts/test-overseas-seller-verify.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  for (const name of [".env", ".env.local"]) {
    const path = resolve(process.cwd(), name);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 1) continue;
      const key = t.slice(0, i).trim();
      let val = t.slice(i + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

loadEnv();

const API = (process.env.APP_URL || "http://localhost:8080").replace(/\/$/, "");
const CLERK_SECRET = process.env.CLERK_SECRET_KEY?.trim();
const CLERK_USER_ID =
  process.env.CLERK_USER_ID?.trim() || "user_3IXpJ2opzm0Pf4pGfjQEPOVqi7E"; // kabir seller

const FORM = {
  companyName: "Gujarat Textile Mills",
  legalName: "Gujarat Textile Mills Private Limited",
  country: "Kenya",
  businessAddress: "Plot 42, GIDC Pandesara, Near Ring Road",
  city: "Nairobi",
  contactPerson: "Rajesh Patel",
  contactPhone: "+254712345678",
  contactEmail: "rajesh@gujtextilemills.co.ke",
  website: "https://www.gujtextilemills.co.ke",
  businessRegistrationNumber: "CPR/2024/88421",
  taxId: "P051234567K",
};

async function clerkBearerToken() {
  if (!CLERK_SECRET) throw new Error("CLERK_SECRET_KEY missing");
  const sessionRes = await fetch("https://api.clerk.com/v1/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CLERK_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id: CLERK_USER_ID }),
  });
  const session = await sessionRes.json().catch(() => ({}));
  if (!sessionRes.ok || !session.id) {
    throw new Error(session.errors?.[0]?.message || "Could not create Clerk session");
  }
  const tokenRes = await fetch(
    `https://api.clerk.com/v1/sessions/${session.id}/tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CLERK_SECRET}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: "{}",
    },
  );
  const tokenBody = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenBody.jwt) {
    throw new Error(tokenBody.errors?.[0]?.message || "Could not mint Clerk JWT");
  }
  return tokenBody.jwt;
}

async function api(method, path, token, body) {
  const res = await fetch(`${API}/api${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function log(step, msg, extra) {
  console.log(`\n[${step}] ${msg}`);
  if (extra) console.log(JSON.stringify(extra, null, 2));
}

async function main() {
  console.log("Overseas seller verify E2E test");
  console.log("API:", API);
  console.log("Clerk user:", CLERK_USER_ID);

  const health = await fetch(`${API}/api/healthz`);
  if (!health.ok) throw new Error("API not reachable — run pnpm dev");

  const token = await clerkBearerToken();
  log("auth", "Clerk session OK");

  // Ensure shop exists
  let me = await api("GET", "/suppliers/me", token);
  if (me.status === 404) {
    const setup = await api("POST", "/shop/setup", token, {
      companyName: FORM.companyName,
      location: FORM.city,
      region: "usd",
    });
    log("shop", setup.ok ? "Created free shop" : "Shop setup failed", setup.data);
    if (!setup.ok) process.exit(1);
    me = await api("GET", "/suppliers/me", token);
  }
  log("supplier", "Linked supplier", {
    id: me.data?.id,
    country: me.data?.country,
    verificationStatus: me.data?.verificationStatus,
  });

  // Step 1 — company profile
  const s1 = await api("POST", "/suppliers/me/verification", token, {
    step: 1,
    submit: false,
    data: {
      companyName: FORM.companyName,
      legalName: FORM.legalName,
      country: FORM.country,
      businessAddress: FORM.businessAddress,
      city: FORM.city,
      state: "Nairobi County",
      pincode: "",
      description: "Textile manufacturing and export",
      yearEstablished: "2018",
      employeeCount: "51-200",
      mainProducts: "Cotton fabric, Yarn",
    },
  });
  log("step1", s1.ok ? "Company saved" : "Step 1 failed", s1.data);
  if (!s1.ok) process.exit(1);

  // Step 2 — contact + email OTP
  const s2save = await api("POST", "/suppliers/me/verification", token, {
    step: 2,
    submit: false,
    data: {
      contactPerson: FORM.contactPerson,
      contactPhone: FORM.contactPhone,
      contactEmail: FORM.contactEmail,
      website: FORM.website,
    },
  });
  log("step2", s2save.ok ? "Contact saved" : "Step 2 save failed", s2save.data);
  if (!s2save.ok) process.exit(1);

  const otpSend = await api("POST", "/suppliers/me/verification/email-otp", token, {
    email: FORM.contactEmail,
  });
  log("otp-send", otpSend.ok ? "OTP sent" : "OTP send failed", otpSend.data);
  if (!otpSend.ok) process.exit(1);

  const code = process.env.TEST_OTP_CODE?.trim();
  if (!code) {
    console.error(
      "\nOTP is no longer returned in API responses.\n" +
        "Check the inbox for the real Sendmator email code, then re-run with:\n" +
        "  TEST_OTP_CODE=123456 node scripts/test-overseas-seller-verify.mjs",
    );
    process.exit(1);
  }

  const otpConfirm = await api(
    "POST",
    "/suppliers/me/verification/email-otp/confirm",
    token,
    { code: String(code) },
  );
  log("otp-confirm", otpConfirm.ok ? "Email verified" : "OTP confirm failed", otpConfirm.data);
  if (!otpConfirm.ok) process.exit(1);

  // Step 3 — registration
  const s3 = await api("POST", "/suppliers/me/verification", token, {
    step: 3,
    submit: false,
    data: {
      businessRegistrationNumber: FORM.businessRegistrationNumber,
      businessRegistrationDocumentUrl: "https://example.com/test-registration.pdf",
    },
  });
  log("step3", s3.ok ? "Registration saved" : "Step 3 failed", s3.data);
  if (!s3.ok) process.exit(1);

  // Step 4 — tax ID (stored in gstin field for overseas)
  const s4 = await api("POST", "/suppliers/me/verification", token, {
    step: 4,
    submit: false,
    data: { gstin: FORM.taxId },
  });
  log("step4", s4.ok ? "Tax ID saved" : "Step 4 failed", s4.data);
  if (!s4.ok) process.exit(1);

  // Step 5 — submit
  const submit = await api("POST", "/suppliers/me/verification", token, {
    step: 5,
    submit: true,
    data: {},
  });
  log("submit", submit.ok ? "KYC submitted" : "Submit failed", submit.data);

  const final = await api("GET", "/suppliers/me", token);
  const s = final.data;
  log("final", "Seller status after submit", {
    verificationStatus: s?.verificationStatus,
    verificationStep: s?.verificationStep,
    verified: s?.verified,
    businessEmailVerified: s?.businessEmailVerified,
    country: s?.country,
    pendingReview: submit.data?.pendingReview,
  });

  console.log("\n--- Summary ---");
  console.log("Email OTP:", otpConfirm.ok ? "PASS" : "FAIL");
  console.log("KYC submit:", submit.ok ? "PASS" : "FAIL");
  console.log(
    "Seller verified badge (public):",
    s?.verified ? "YES (India GST only normally)" : "NO — expected for overseas",
  );
  console.log(
    "Verification status:",
    s?.verificationStatus,
    s?.verificationStatus === "pending" ? "(pending admin review — expected)" : "",
  );
}

main().catch((e) => {
  console.error("\nTest failed:", e.message || e);
  process.exit(1);
});
