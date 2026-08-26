import { createHash, randomInt, timingSafeEqual } from "node:crypto";

const OTP_TTL_MS = 15 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

function pepper(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === "production" || process.env.VERCEL === "1") {
    throw new Error("SESSION_SECRET is required for email OTP in production");
  }
  return "karm-baba-dev-otp-pepper";
}

export function generateEmailOtp(): string {
  return String(randomInt(100000, 999999));
}

export function hashEmailOtp(code: string, email: string): string {
  return createHash("sha256")
    .update(`${pepper()}:${email.trim().toLowerCase()}:${code.trim()}`)
    .digest("hex");
}

export function otpExpiresAt(from = Date.now()): Date {
  return new Date(from + OTP_TTL_MS);
}

export function otpResendAllowed(
  expiresAt: Date | null | undefined,
  now = Date.now(),
): boolean {
  if (!expiresAt) return true;
  // OTP issued at expiresAt - TTL; allow resend after cooldown from issue time.
  const issuedAt = expiresAt.getTime() - OTP_TTL_MS;
  return now >= issuedAt + RESEND_COOLDOWN_MS;
}

export function verifyEmailOtpHash(
  code: string,
  email: string,
  storedHash: string | null | undefined,
): boolean {
  if (!storedHash) return false;
  const next = hashEmailOtp(code, email);
  try {
    const a = Buffer.from(next, "hex");
    const b = Buffer.from(storedHash, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export { OTP_TTL_MS, RESEND_COOLDOWN_MS };
