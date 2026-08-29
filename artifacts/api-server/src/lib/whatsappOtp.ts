import { logger } from "./logger";
import { buildWhatsappE164 } from "./phoneDialCodes";

export type SendWhatsappOtpInput = {
  to: string;
  code: string;
  /** Country name or dial digits — used when `to` is a national number. */
  country?: string | null;
};

/**
 * Try Meta Cloud WhatsApp only. Returns null when Meta is not configured.
 */
export async function sendWhatsappOtp(
  input: SendWhatsappOtpInput,
): Promise<{ ok: true; mode: "meta" } | { ok: false; error: string } | null> {
  const to = normalizeWhatsappTo(input.to, input.country);
  if (!to) {
    return { ok: false, error: "Enter a valid WhatsApp number with country code" };
  }

  const body = `Your Karm Baba buyer verification code is ${input.code}. It expires in 15 minutes.`;
  return sendViaMeta(to, body, input.code);
}

/**
 * Normalize to E.164 (+…).
 * Pass `country` (e.g. "India") so national numbers like 9876543210 become +919876543210.
 */
export function normalizeWhatsappTo(
  raw: string,
  country?: string | null,
): string | null {
  return buildWhatsappE164(raw, country);
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
