import { logger } from "./logger";

export type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

/**
 * Send transactional email.
 * Prefer Twilio Verify (via otpDelivery) for OTP flows.
 * Falls back to Resend when RESEND_API_KEY is set; otherwise logs in development.
 */
export async function sendMail(
  input: SendMailInput,
): Promise<{ ok: true; mode: "resend" | "dev-log" } | { ok: false; error: string }> {
  const key = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.EMAIL_FROM?.trim() || "Karm Baba <onboarding@resend.dev>";

  if (key) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [input.to],
          subject: input.subject,
          text: input.text,
          html: input.html ?? `<pre>${escapeHtml(input.text)}</pre>`,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        logger.error({ status: res.status, body }, "Resend email failed");
        return { ok: false, error: "Could not send verification email. Try again shortly." };
      }
      return { ok: true, mode: "resend" };
    } catch (err) {
      logger.error({ err }, "Resend email request error");
      return { ok: false, error: "Could not send verification email. Try again shortly." };
    }
  }

  if (process.env.NODE_ENV === "production") {
    return {
      ok: false,
      error:
        "Email delivery is not configured. Set TWILIO_VERIFY_SERVICE_SID + Twilio API credentials, or RESEND_API_KEY and EMAIL_FROM.",
    };
  }

  logger.info(
    { to: input.to, subject: input.subject, text: input.text },
    "Dev email (no RESEND_API_KEY) — OTP logged",
  );
  return { ok: true, mode: "dev-log" };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
