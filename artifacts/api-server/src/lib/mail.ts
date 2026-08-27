import { logger } from "./logger";

export type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

/**
 * Send transactional email via Resend when RESEND_API_KEY is set.
 * Without a key: logs in development (so OTP flow is testable locally).
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
        "Email delivery is not configured. Ask the platform admin to set RESEND_API_KEY and EMAIL_FROM on the server.",
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
