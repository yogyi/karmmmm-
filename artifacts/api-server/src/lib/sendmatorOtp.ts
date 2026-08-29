import { logger } from "./logger";

const API_BASE = "https://api.sendmator.com/api/v1";
export const SENDMATOR_OTP_PREFIX = "sendmator:";

export type SendmatorChannel = "email" | "whatsapp";

export function getSendmatorApiKey(): string | null {
  return process.env.SENDMATOR_API_KEY?.trim() || null;
}

export function isSendmatorConfigured(): boolean {
  return getSendmatorApiKey() != null;
}

export function encodeSendmatorSession(token: string): string {
  return `${SENDMATOR_OTP_PREFIX}${token}`;
}

export function decodeSendmatorSession(stored: string | null | undefined): string | null {
  if (!stored?.startsWith(SENDMATOR_OTP_PREFIX)) return null;
  const token = stored.slice(SENDMATOR_OTP_PREFIX.length).trim();
  return token || null;
}

export function isSendmatorSession(stored: string | null | undefined): boolean {
  return decodeSendmatorSession(stored) != null;
}

function parseSendmatorError(data: unknown): string {
  if (data && typeof data === "object") {
    const o = data as { message?: string; error?: string };
    if (typeof o.message === "string" && o.message.trim()) return o.message.trim();
    if (typeof o.error === "string" && o.error.trim()) return o.error.trim();
  }
  return "Sendmator OTP request failed";
}

/** Send OTP via Sendmator (email or WhatsApp). Returns session token for verify step. */
export async function sendmatorOtpSend(
  channel: SendmatorChannel,
  recipient: string,
  metadata?: Record<string, string>,
): Promise<
  | {
      ok: true;
      sessionToken: string;
      expiresAt?: string;
      previewCode?: string;
    }
  | { ok: false; error: string }
> {
  const key = getSendmatorApiKey();
  if (!key) {
    return { ok: false, error: "Sendmator is not configured (set SENDMATOR_API_KEY)" };
  }

  const sandbox = process.env.SENDMATOR_SANDBOX_MODE === "true";
  const recipients =
    channel === "email" ? { email: recipient } : { whatsapp: recipient };

  try {
    const res = await fetch(`${API_BASE}/otp/send`, {
      method: "POST",
      headers: {
        "X-API-Key": key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channels: [channel],
        recipients,
        config: {
          otp_length: 6,
          expiry_minutes: 15,
          max_attempts: 5,
        },
        metadata: {
          purpose: "karm_baba_verification",
          ...metadata,
        },
        sandbox_mode: sandbox,
      }),
    });

    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok) {
      logger.error({ status: res.status, channel, data }, "Sendmator OTP send failed");
      return { ok: false, error: parseSendmatorError(data) };
    }

    const sessionToken =
      (typeof data?.session_token === "string" && data.session_token) ||
      (typeof data?.token === "string" && data.token) ||
      "";
    if (!sessionToken) {
      return { ok: false, error: "Sendmator did not return a session token" };
    }

    const channelSent = data?.channels_sent as Record<string, { success?: boolean }> | undefined;
    const sentOk = channelSent?.[channel]?.success;
    if (sentOk === false) {
      return { ok: false, error: `Could not deliver OTP via ${channel}` };
    }

    const sandboxOtps = data?.sandbox_otps as Record<string, string> | undefined;
    return {
      ok: true,
      sessionToken,
      expiresAt:
        typeof data?.expires_at === "string" ? data.expires_at : undefined,
      previewCode: sandboxOtps?.[channel],
    };
  } catch (err) {
    logger.error({ err, channel }, "Sendmator OTP send error");
    return { ok: false, error: "Could not send verification code. Try again shortly." };
  }
}

/** Verify OTP code against a Sendmator session token. */
export async function sendmatorOtpVerify(
  sessionToken: string,
  channel: SendmatorChannel,
  code: string,
): Promise<
  | { ok: true }
  | {
      ok: false;
      error: string;
      invalid?: boolean;
      expired?: boolean;
      locked?: boolean;
      attemptsRemaining?: number;
    }
> {
  const key = getSendmatorApiKey();
  if (!key) {
    return { ok: false, error: "Sendmator is not configured" };
  }

  try {
    const res = await fetch(`${API_BASE}/otp/verify`, {
      method: "POST",
      headers: {
        "X-API-Key": key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session_token: sessionToken,
        otps: { [channel]: code },
      }),
    });

    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;

    if (res.ok && data?.verified === true) {
      return { ok: true };
    }

    const msg = parseSendmatorError(data);
    const lower = msg.toLowerCase();
    const details = data?.details as { attempts_remaining?: number } | undefined;

    if (lower.includes("expired")) {
      return { ok: false, error: "Code expired — request a new one", expired: true };
    }
    if (lower.includes("maximum") || lower.includes("attempts exceeded")) {
      return {
        ok: false,
        error: "Too many incorrect attempts — request a new code",
        locked: true,
      };
    }
    if (lower.includes("invalid otp") || lower.includes("invalid")) {
      return {
        ok: false,
        error: "Incorrect code — check and try again",
        invalid: true,
        attemptsRemaining: details?.attempts_remaining,
      };
    }

    logger.warn({ status: res.status, data }, "Sendmator OTP verify failed");
    return { ok: false, error: msg, invalid: res.status === 400 };
  } catch (err) {
    logger.error({ err }, "Sendmator OTP verify error");
    return { ok: false, error: "Could not verify code. Try again shortly." };
  }
}
