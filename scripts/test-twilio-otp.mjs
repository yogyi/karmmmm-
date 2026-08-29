#!/usr/bin/env node
/**
 * Smoke-test Twilio OTP credentials (Verify + optional WhatsApp Messages).
 *
 * Usage (set env vars — never commit secrets):
 *   TWILIO_ACCOUNT_SID=AC...
 *   TWILIO_API_KEY_SID=SK...
 *   TWILIO_API_KEY_SECRET=...
 *   TWILIO_VERIFY_SERVICE_SID=VA...   # Create in Twilio Console → Verify → Services
 *   TWILIO_WHATSAPP_FROM=whatsapp:+14155238886   # optional, for Messages API fallback test
 *   TEST_EMAIL=you@company.com       # optional
 *   TEST_WHATSAPP=+971501234567      # optional
 *
 *   node scripts/test-twilio-otp.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadDotEnv() {
  const path = resolve(process.cwd(), ".env");
  if (!existsSync(path)) return;
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

loadDotEnv();

const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
const apiKeySid =
  process.env.TWILIO_API_KEY_SID?.trim() || process.env.TWILIO_API_KEY?.trim();
const apiKeySecret =
  process.env.TWILIO_API_KEY_SECRET?.trim() ||
  process.env.TWILIO_API_SECRET?.trim();
const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
const verifySid = process.env.TWILIO_VERIFY_SERVICE_SID?.trim();
const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM?.trim();
const testEmail = process.env.TEST_EMAIL?.trim();
const testWhatsapp = process.env.TEST_WHATSAPP?.trim();

function authHeader() {
  if (apiKeySid?.startsWith("SK") && apiKeySecret) {
    return `Basic ${Buffer.from(`${apiKeySid}:${apiKeySecret}`).toString("base64")}`;
  }
  if (accountSid && authToken) {
    return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
  }
  return null;
}

async function twilioFetch(url, body) {
  const auth = authHeader();
  if (!auth) throw new Error("Missing Twilio credentials");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body).toString(),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* ignore */
  }
  return { ok: res.ok, status: res.status, text, json };
}

console.log("Twilio OTP smoke test\n");

if (!accountSid) {
  console.error("Missing TWILIO_ACCOUNT_SID (starts with AC — find on twilio.com/console)");
  process.exit(1);
}
console.log("Account SID:", accountSid);

if (!authHeader()) {
  console.error("Missing TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET (or TWILIO_AUTH_TOKEN)");
  process.exit(1);
}
console.log("Auth: OK (API key or auth token)");

if (!verifySid) {
  console.warn(
    "\nMissing TWILIO_VERIFY_SERVICE_SID — create a Verify service at:\n" +
      "  https://console.twilio.com/us1/develop/verify/services\n" +
      "Then set TWILIO_VERIFY_SERVICE_SID=VA...\n",
  );
} else {
  console.log("Verify service:", verifySid);

  if (testEmail) {
    console.log("\nSending email Verify OTP to", testEmail, "…");
    const r = await twilioFetch(
      `https://verify.twilio.com/v2/Services/${verifySid}/Verifications`,
      { To: testEmail, Channel: "email" },
    );
    if (r.ok) {
      console.log("  ✓ Email Verify started:", r.json?.status ?? "pending");
    } else {
      console.error("  ✗ Email Verify failed:", r.status, r.json?.message ?? r.text);
    }
  }

  if (testWhatsapp) {
    const to = testWhatsapp.startsWith("+") ? testWhatsapp : `+${testWhatsapp}`;
    console.log("\nSending WhatsApp Verify OTP to", to, "…");
    const r = await twilioFetch(
      `https://verify.twilio.com/v2/Services/${verifySid}/Verifications`,
      { To: to, Channel: "whatsapp" },
    );
    if (r.ok) {
      console.log("  ✓ WhatsApp Verify started:", r.json?.status ?? "pending");
    } else {
      console.error("  ✗ WhatsApp Verify failed:", r.status, r.json?.message ?? r.text);
    }
  }
}

if (whatsappFrom && testWhatsapp && accountSid) {
  const to = testWhatsapp.startsWith("+") ? testWhatsapp : `+${testWhatsapp}`;
  const fromWa = whatsappFrom.startsWith("whatsapp:")
    ? whatsappFrom
    : `whatsapp:${whatsappFrom}`;
  console.log("\nSending WhatsApp message (Messages API) to", to, "…");
  const r = await twilioFetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      From: fromWa,
      To: `whatsapp:${to.replace(/^\+/, "+")}`,
      Body: "Karm Baba Twilio test — if you received this, WhatsApp Messages API works.",
    },
  );
  if (r.ok) {
    console.log("  ✓ Message queued:", r.json?.sid);
  } else {
    console.error("  ✗ Message failed:", r.status, r.json?.message ?? r.text);
  }
}

if (!testEmail && !testWhatsapp) {
  console.log(
    "\nSet TEST_EMAIL and/or TEST_WHATSAPP to send a real test OTP.",
  );
}

console.log("\nDone.");
