#!/usr/bin/env node
/**
 * Smoke-test Sendmator OTP API (sandbox or live).
 *
 *   SENDMATOR_API_KEY=sk_live_... node scripts/test-sendmator-otp.mjs
 *   SENDMATOR_SANDBOX_MODE=true TEST_EMAIL=you@company.com node scripts/test-sendmator-otp.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadDotEnv() {
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

loadDotEnv();

const API_KEY = process.env.SENDMATOR_API_KEY?.trim();
const sandbox = process.env.SENDMATOR_SANDBOX_MODE === "true";
const testEmail = process.env.TEST_EMAIL?.trim();
const testWhatsapp = process.env.TEST_WHATSAPP?.trim();

if (!API_KEY) {
  console.error("Set SENDMATOR_API_KEY (from app.sendmator.com/api-keys)");
  process.exit(1);
}

console.log("Sendmator OTP smoke test");
console.log("Mode:", sandbox ? "sandbox (no charge)" : "live");
console.log("Key prefix:", API_KEY.slice(0, 12) + "…");

async function send(channel, recipient) {
  const recipients =
    channel === "email" ? { email: recipient } : { whatsapp: recipient };
  const res = await fetch("https://api.sendmator.com/api/v1/otp/send", {
    method: "POST",
    headers: {
      "X-API-Key": API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channels: [channel],
      recipients,
      config: { otp_length: 6, expiry_minutes: 15 },
      sandbox_mode: sandbox,
    }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function verify(token, channel, code) {
  const res = await fetch("https://api.sendmator.com/api/v1/otp/verify", {
    method: "POST",
    headers: {
      "X-API-Key": API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      session_token: token,
      otps: { [channel]: code },
    }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

// Auth check via sandbox email send
const probe = await send("email", testEmail || "probe@example.com");
if (!probe.ok) {
  console.error("\n✗ API key or account issue:", probe.status, probe.data?.message ?? probe.data);
  process.exit(1);
}

console.log("\n✓ API key accepted");
console.log("  session_token:", probe.data.session_token ? "received" : "missing");
if (probe.data.expires_at) console.log("  expires_at:", probe.data.expires_at);

if (sandbox && probe.data.sandbox_otps?.email) {
  const code = probe.data.sandbox_otps.email;
  console.log("  sandbox OTP (email):", code);
  const checked = await verify(probe.data.session_token, "email", code);
  if (checked.ok && checked.data.verified) {
    console.log("✓ Sandbox verify round-trip OK");
  } else {
    console.error("✗ Sandbox verify failed:", checked.data?.message ?? checked.status);
  }
}

if (testEmail && !sandbox) {
  console.log("\nLive email OTP sent to", testEmail);
}

if (testWhatsapp) {
  const wa = testWhatsapp.startsWith("+") ? testWhatsapp : `+${testWhatsapp}`;
  console.log("\nWhatsApp OTP to", wa, "…");
  const waSend = await send("whatsapp", wa);
  if (waSend.ok) {
    console.log("✓ WhatsApp send OK");
    if (sandbox && waSend.data.sandbox_otps?.whatsapp) {
      console.log("  sandbox OTP:", waSend.data.sandbox_otps.whatsapp);
    }
  } else {
    console.error("✗ WhatsApp send failed:", waSend.data?.message ?? waSend.status);
  }
}

console.log("\nDone.");
