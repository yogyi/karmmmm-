import { logger } from "./logger";
import { getTwilioAuth, twilioBasicAuthHeader } from "./twilioConfig";

export type SendWhatsappOtpInput = {
  to: string;
  code: string;
};

/**
 * Send a 6-digit OTP over WhatsApp.
 * Prefers Twilio WhatsApp when TWILIO_* env vars are set; otherwise Meta Cloud API;
 * in non-production without credentials, logs the code (same pattern as email OTP).
 */
export async function sendWhatsappOtp(
  input: SendWhatsappOtpInput,
): Promise<{ ok: true; mode: "twilio" | "meta" | "dev-log" } | { ok: false; error: string }> {
  const to = normalizeWhatsappTo(input.to);
  if (!to) {
    return { ok: false, error: "Enter a valid WhatsApp number with country code" };
  }

  const body = `Your Karm Baba buyer verification code is ${input.code}. It expires in 15 minutes.`;

  const twilio = await sendViaTwilio(to, body);
  if (twilio) return twilio;

  const meta = await sendViaMeta(to, body, input.code);
  if (meta) return meta;

  if (process.env.NODE_ENV === "production" || process.env.VERCEL === "1") {
    return {
      ok: false,
      error:
        "WhatsApp delivery is not configured. Ask the platform admin to set Twilio or Meta WhatsApp credentials.",
    };
  }

  logger.info({ to, code: input.code }, "Dev WhatsApp OTP (no provider) — OTP logged");
  return { ok: true, mode: "dev-log" };
}

/** E.164-ish digits with leading +. */
export function normalizeWhatsappTo(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/[^\d+]/g, "");
  const withPlus = digits.startsWith("+") ? digits : `+${digits.replace(/^\+/, "")}`;
  const only = withPlus.replace(/\D/g, "");
  if (only.length < 8 || only.length > 15) return null;
  return `+${only}`;
}

async function sendViaTwilio(
  to: string,
  body: string,
): Promise<{ ok: true; mode: "twilio" } | { ok: false; error: string } | null> {
  const auth = getTwilioAuth();
  const from = process.env.TWILIO_WHATSAPP_FROM?.trim();
  if (!auth || !from) return null;

  const fromWa = from.startsWith("whatsapp:") ? from : `whatsapp:${from}`;
  const toWa = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(auth.accountSid)}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: twilioBasicAuthHeader(auth),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ From: fromWa, To: toWa, Body: body }).toString(),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      logger.error({ status: res.status, text }, "Twilio WhatsApp OTP failed");
      return { ok: false, error: "Could not send WhatsApp code. Try again shortly." };
    }
    return { ok: true, mode: "twilio" };
  } catch (err) {
    logger.error({ err }, "Twilio WhatsApp request error");
    return { ok: false, error: "Could not send WhatsApp code. Try again shortly." };
  }
}

async function sendViaMeta(
  to: string,
  body: string,
  code: string,
): Promise<{ ok: true; mode: "meta" } | { ok: false; error: string } | null> {
  const token = process.env.META_WHATSAPP_TOKEN?.trim();
  const phoneId = process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!token || !phoneId) return null;

  const digits = to.replace(/\D/g, "");
  const template = process.env.META_WHATSAPP_OTP_TEMPLATE?.trim();

  try {
    const payload = template
      ? {
          messaging_product: "whatsapp",
          to: digits,
          type: "template",
          template: {
            name: template,
            language: { code: process.env.META_WHATSAPP_OTP_LANG?.trim() || "en" },
            components: [
              {
                type: "body",
                parameters: [{ type: "text", text: code }],
              },
              {
                type: "button",
                sub_type: "url",
                index: "0",
                parameters: [{ type: "text", text: code }],
              },
            ],
          },
        }
      : {
          messaging_product: "whatsapp",
          to: digits,
          type: "text",
          text: { body },
        };

    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      logger.error({ status: res.status, text }, "Meta WhatsApp OTP failed");
      return { ok: false, error: "Could not send WhatsApp code. Try again shortly." };
    }
    return { ok: true, mode: "meta" };
  } catch (err) {
    logger.error({ err }, "Meta WhatsApp request error");
    return { ok: false, error: "Could not send WhatsApp code. Try again shortly." };
  }
}
