import { logger } from "./logger";

const API_BASE = "https://api.sendmator.com/api/v1";
export const SENDMATOR_OTP_PREFIX = "sendmator:";

export type SendmatorChannel = "email" | "whatsapp" | "sms";
export type SendmatorPhoneChannel = "whatsapp" | "sms";

export function getSendmatorApiKey(): string | null {
  return process.env.SENDMATOR_API_KEY?.trim() || null;
}

export function isSendmatorConfigured(): boolean {
  return getSendmatorApiKey() != null;
}

/** Sandbox never sends real WhatsApp/SMS/email — only useful for automated tests. */
export function isSendmatorSandbox(): boolean {
  return (
    process.env.SENDMATOR_SANDBOX_MODE === "true" &&
    process.env.NODE_ENV !== "production"
  );
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

function extractSessionToken(data: Record<string, unknown> | null): string {
  if (!data) return "";
  for (const key of ["session_token", "token", "session_id"] as const) {
    const v = data[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

/**
 * Phone OTP channels. Default: WhatsApp + SMS so India / overseas users still get a code
 * if WhatsApp Business delivery is flaky. Override with SENDMATOR_PHONE_OTP_CHANNELS=whatsapp
 */
export function phoneOtpChannels(): SendmatorPhoneChannel[] {
  const raw = process.env.SENDMATOR_PHONE_OTP_CHANNELS?.trim();
  if (!raw) return ["whatsapp", "sms"];
  const parsed = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is SendmatorPhoneChannel => s === "whatsapp" || s === "sms");
  return parsed.length > 0 ? parsed : ["whatsapp", "sms"];
}

function channelSucceeded(
  data: Record<string, unknown> | null,
  channel: SendmatorChannel,
): boolean | null {
  if (!data) return null;
  const results = (data.channels_results ?? data.channels_sent) as unknown;
  if (!results) return null;

  if (Array.isArray(results)) {
    return results.includes(channel) ? true : null;
  }

  if (typeof results !== "object" || results === null) return null;
  const entry = (results as Record<string, unknown>)[channel];
  if (entry == null) return null;
  if (typeof entry === "boolean") return entry;
  if (typeof entry !== "object") return null;

  const o = entry as {
    success?: boolean;
    message_id?: string;
    trigger_id?: string;
    execution_id?: string;
    error?: string;
  };
  if (o.success === true) return true;
  if (o.success === false) return false;
  if (o.message_id || o.trigger_id || o.execution_id) return true;
  if (typeof o.error === "string" && o.error.trim()) return false;
  return null;
}

function anyChannelDelivered(
  data: Record<string, unknown> | null,
  channels: SendmatorChannel[],
): boolean {
  const outcomes = channels.map((c) => channelSucceeded(data, c));
  if (outcomes.some((o) => o === true)) return true;
  if (outcomes.every((o) => o === false)) return false;
  // Ambiguous response shape — keep session if HTTP 200 returned a token (legacy payloads).
  logger.warn(
    { channels, channels_sent: data?.channels_sent, channels_results: data?.channels_results },
    "Sendmator OTP: delivery status ambiguous — accepting session",
  );
  return true;
}

type SendOk = {
  ok: true;
  sessionToken: string;
  expiresAt?: string;
  channels: SendmatorChannel[];
};
type SendFail = { ok: false; error: string };

async function sendmatorOtpRequest(
  channels: SendmatorChannel[],
  recipients: Record<string, string>,
  metadata?: Record<string, string>,
): Promise<SendOk | SendFail> {
  const key = getSendmatorApiKey();
  if (!key) {
    return { ok: false, error: "Sendmator is not configured (set SENDMATOR_API_KEY)" };
  }

  const sandbox = isSendmatorSandbox();

  try {
    const res = await fetch(`${API_BASE}/otp/send`, {
      method: "POST",
      headers: {
        "X-API-Key": key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channels,
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
      logger.error({ status: res.status, channels, data }, "Sendmator OTP send failed");
      return { ok: false, error: parseSendmatorError(data) };
    }

    const sessionToken = extractSessionToken(data);
    if (!sessionToken) {
      return { ok: false, error: "Sendmator did not return a session token" };
    }

    if (!anyChannelDelivered(data, channels)) {
      logger.error(
        { channels, channels_sent: data?.channels_sent, channels_results: data?.channels_results },
        "Sendmator OTP: no channel reported successful delivery",
      );
      return {
        ok: false,
        error:
          "Could not deliver the verification code by WhatsApp/SMS. Check the number and try again.",
      };
    }

    if (sandbox) {
      const sandboxOtps = data?.sandbox_otps as Record<string, string> | undefined;
      logger.info(
        {
          channels,
          hasSandboxOtps: Boolean(sandboxOtps && Object.keys(sandboxOtps).length),
        },
        "Sendmator sandbox OTP issued (not returned to client)",
      );
    } else {
      logger.info(
        {
          channels,
          delivered: channels.filter((c) => channelSucceeded(data, c) === true),
        },
        "Sendmator phone/email OTP accepted",
      );
    }

    return {
      ok: true,
      sessionToken,
      channels,
      expiresAt: typeof data?.expires_at === "string" ? data.expires_at : undefined,
    };
  } catch (err) {
    logger.error({ err, channels }, "Sendmator OTP send error");
    return { ok: false, error: "Could not send verification code. Try again shortly." };
  }
}

/** Send OTP via Sendmator (single channel: email or WhatsApp). */
export async function sendmatorOtpSend(
  channel: SendmatorChannel,
  recipient: string,
  metadata?: Record<string, string>,
): Promise<SendOk | SendFail> {
  const recipients: Record<string, string> =
    channel === "email"
      ? { email: recipient }
      : channel === "sms"
        ? { sms: recipient }
        : { whatsapp: recipient };
  return sendmatorOtpRequest([channel], recipients, metadata);
}

/**
 * Send phone OTP via WhatsApp and/or SMS (E.164 with +).
 * Prefer this for buyer WhatsApp KYC so India (+91) and overseas numbers both get a code.
 */
export async function sendmatorOtpSendPhone(
  e164: string,
  metadata?: Record<string, string>,
): Promise<SendOk | SendFail> {
  const channels = phoneOtpChannels();
  const recipients: Record<string, string> = {};
  for (const ch of channels) {
    if (ch === "whatsapp") recipients.whatsapp = e164;
    if (ch === "sms") recipients.sms = e164;
  }
  const sent = await sendmatorOtpRequest(channels, recipients, metadata);
  if (sent.ok) return sent;

  // Many Sendmator accounts have WhatsApp before SMS — retry WhatsApp-only.
  if (channels.includes("whatsapp") && channels.length > 1) {
    logger.warn(
      { error: sent.error },
      "Sendmator multi-channel phone OTP failed — retrying WhatsApp only",
    );
    return sendmatorOtpRequest(["whatsapp"], { whatsapp: e164 }, metadata);
  }
  return sent;
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
  return sendmatorOtpVerifyOtps(sessionToken, { [channel]: code });
}

/** Verify phone OTP — accepts code from WhatsApp or SMS (same session). */
export async function sendmatorOtpVerifyPhone(
  sessionToken: string,
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
  // Progressive verify: one channel is enough. Try WhatsApp first, then SMS
  // only when that channel was not part of the session (avoids burning attempts twice).
  const viaWa = await sendmatorOtpVerifyOtps(sessionToken, { whatsapp: code });
  if (viaWa.ok) return viaWa;
  const msg = (viaWa.error || "").toLowerCase();
  if (
    msg.includes("channel not found") ||
    msg.includes("not found in session") ||
    msg.includes("was not sent")
  ) {
    return sendmatorOtpVerifyOtps(sessionToken, { sms: code });
  }
  return viaWa;
}

async function sendmatorOtpVerifyOtps(
  sessionToken: string,
  otps: Partial<Record<SendmatorChannel, string>>,
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
        // Docs use `token`; some responses/examples use `session_token`.
        token: sessionToken,
        session_token: sessionToken,
        otps,
      }),
    });

    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;

    if (res.ok && (data?.verified === true || data?.session_verified === true)) {
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

/**
 * Send OUR OTP via Sendmator SMS API (not /otp/send).
 * Uses template_key from SENDMATOR_SMS_OTP_TEMPLATE (default verify-api-otp-sms / otp-sms).
 */
export async function sendmatorSmsTemplateOtp(
  e164: string,
  code: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const key = getSendmatorApiKey();
  if (!key) return { ok: false, error: "Sendmator is not configured" };

  const templates = [
    process.env.SENDMATOR_SMS_OTP_TEMPLATE?.trim(),
    "verify-api-otp-sms",
    "otp-sms",
    "otp-verification",
    "otp_verification",
  ].filter((t): t is string => Boolean(t));

  let lastError = "SMS send failed";
  for (const template of templates) {
    try {
      const res = await fetch(`${API_BASE}/sms/send`, {
        method: "POST",
        headers: {
          "X-API-Key": key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          template_key: template,
          recipient_type: "direct_sms",
          direct_phone: e164,
          direct_sms: e164,
          variables: {
            otp_code: code,
            expiry_minutes: "15",
            code,
            app_name: "Karm Baba",
            appName: "Karm Baba",
            "1": code,
            "2": "15",
          },
        }),
      });
      const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (res.ok) {
        logger.info(
          { to: e164.slice(0, 4) + "***", template },
          "Sendmator SMS template OTP sent",
        );
        return { ok: true };
      }
      lastError = parseSendmatorError(data);
      logger.warn({ status: res.status, data, template }, "Sendmator SMS template send failed");
    } catch (err) {
      logger.error({ err, template }, "Sendmator SMS template request error");
      lastError = "Could not send SMS";
    }
  }
  return { ok: false, error: lastError };
}

/**
 * Send OUR OTP via Sendmator WhatsApp template API (not /otp/send).
 * Requires an approved AUTHENTICATION template on the Sendmator WhatsApp account.
 */
export async function sendmatorWhatsappTemplateOtp(
  e164: string,
  code: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const key = getSendmatorApiKey();
  if (!key) return { ok: false, error: "Sendmator is not configured" };

  const template =
    process.env.SENDMATOR_WHATSAPP_OTP_TEMPLATE?.trim() || "verify_api_otp_whatsapp";
  const category =
    process.env.SENDMATOR_WHATSAPP_OTP_CATEGORY?.trim() || "AUTHENTICATION";

  try {
    const res = await fetch(`${API_BASE}/whatsapp/send`, {
      method: "POST",
      headers: {
        "X-API-Key": key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        template_key: template,
        recipient_type: "direct_whatsapp",
        direct_whatsapp: e164,
        conversation_category: category,
        variables: {
          otp_code: code,
          expiry_minutes: "15",
          code,
          "1": code,
          "2": "15",
        },
      }),
    });
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok) {
      logger.warn({ status: res.status, data, template }, "Sendmator WhatsApp template send failed");
      return { ok: false, error: parseSendmatorError(data) };
    }
    logger.info({ to: e164.slice(0, 4) + "***", template }, "Sendmator WhatsApp template OTP sent");
    return { ok: true };
  } catch (err) {
    logger.error({ err }, "Sendmator WhatsApp template request error");
    return { ok: false, error: "Could not send WhatsApp message" };
  }
}

/** Send a transactional email with our content (for WhatsApp OTP backup). */
export async function sendmatorDirectEmail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const key = getSendmatorApiKey();
  if (!key) return { ok: false, error: "Sendmator is not configured" };

  const fromEmail =
    process.env.SENDMATOR_FROM_EMAIL?.trim() ||
    process.env.EMAIL_FROM?.replace(/^.*<([^>]+)>.*$/, "$1").trim() ||
    undefined;
  const fromName =
    process.env.SENDMATOR_FROM_NAME?.trim() ||
    (process.env.EMAIL_FROM?.includes("<")
      ? process.env.EMAIL_FROM.replace(/<[^>]+>/, "").trim().replace(/^"|"$/g, "")
      : "Karm Baba") ||
    "Karm Baba";

  try {
    const body: Record<string, unknown> = {
      recipient_type: "direct_email",
      direct_email: input.to,
      subject: input.subject,
      content: input.html,
      plain_text_content: input.text,
      from_name: fromName,
    };
    if (fromEmail && fromEmail.includes("@")) body.from_email = fromEmail;

    const res = await fetch(`${API_BASE}/messages/send`, {
      method: "POST",
      headers: {
        "X-API-Key": key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok) {
      logger.warn({ status: res.status, data }, "Sendmator direct email failed");
      return { ok: false, error: parseSendmatorError(data) };
    }
    logger.info(
      { to: input.to.replace(/(^.).*(@.*$)/, "$1***$2") },
      "Sendmator direct email sent",
    );
    return { ok: true };
  } catch (err) {
    logger.error({ err }, "Sendmator direct email request error");
    return { ok: false, error: "Could not send email" };
  }
}
