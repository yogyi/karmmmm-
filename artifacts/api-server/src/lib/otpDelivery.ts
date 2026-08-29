import {
  recordFailedOtpConfirm,
  resetOtpConfirmAttempts,
  verifyEmailOtpHash,
} from "./emailOtp";
import { sendMail } from "./mail";
import {
  decodeSendmatorSession,
  encodeSendmatorSession,
  isSendmatorConfigured,
  isSendmatorSandbox,
  isSendmatorSession,
  sendmatorOtpSend,
  sendmatorOtpVerify,
  sendmatorOtpVerifyPhone,
} from "./sendmatorOtp";
import { sendWhatsappOtp } from "./whatsappOtp";

export type OtpDeliveryMode = "sendmator" | "meta" | "resend" | "dev-log";

export { encodeSendmatorSession, isSendmatorSession };

export async function deliverEmailOtp(
  email: string,
  code: string,
): Promise<
  | {
      ok: true;
      mode: OtpDeliveryMode;
      usesSendmator: boolean;
      sessionToken?: string;
    }
  | { ok: false; error: string }
> {
  if (isSendmatorConfigured()) {
    const sent = await sendmatorOtpSend("email", email);
    if (sent.ok) {
      return {
        ok: true,
        mode: "sendmator",
        usesSendmator: true,
        sessionToken: sent.sessionToken,
      };
    }
    return sent;
  }

  const sent = await sendMail({
    to: email,
    subject: "Your Karm Baba verification code",
    text: `Your Karm Baba verification code is ${code}.\n\nIt expires in 15 minutes.\n\nIf you did not request this, ignore this email.`,
    html: `<p>Your Karm Baba verification code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p><p>It expires in 15 minutes.</p>`,
  });
  if (!sent.ok) return sent;
  // Dev-log mode: code is written to server logs only — never returned to the browser.
  if (sent.mode === "dev-log") {
    const { logger } = await import("./logger");
    logger.info({ email: email.replace(/(^.).*(@.*$)/, "$1***$2") }, "Dev OTP (email) logged — not returned to client");
  }
  return {
    ok: true,
    mode: sent.mode,
    usesSendmator: false,
  };
}

export async function confirmEmailOtp(
  userId: number,
  email: string,
  code: string,
  storedHash: string | null | undefined,
): Promise<
  | { ok: true }
  | { ok: false; error: string; status: number; locked?: boolean }
> {
  const session = decodeSendmatorSession(storedHash);
  if (session) {
    const checked = await sendmatorOtpVerify(session, "email", code);
    if (!checked.ok) {
      if (checked.invalid && !checked.locked) {
        const attempt = recordFailedOtpConfirm(userId, "email");
        if (attempt.locked) {
          return {
            ok: false,
            status: 429,
            locked: true,
            error: "Too many incorrect attempts — request a new code",
          };
        }
        const remaining =
          checked.attemptsRemaining ?? attempt.remaining;
        return {
          ok: false,
          status: 400,
          error: `Incorrect code — ${remaining} attempt(s) remaining`,
        };
      }
      return {
        ok: false,
        status: checked.locked ? 429 : 400,
        locked: checked.locked,
        error: checked.error,
      };
    }
    resetOtpConfirmAttempts(userId, "email");
    return { ok: true };
  }

  if (!verifyEmailOtpHash(code, email, storedHash)) {
    const attempt = recordFailedOtpConfirm(userId, "email");
    if (attempt.locked) {
      return {
        ok: false,
        status: 429,
        locked: true,
        error: "Too many incorrect attempts — request a new code",
      };
    }
    return {
      ok: false,
      status: 400,
      error: `Incorrect code — ${attempt.remaining} attempt(s) remaining`,
    };
  }
  resetOtpConfirmAttempts(userId, "email");
  return { ok: true };
}

/**
 * Deliver OUR phone OTP code (hash-verified locally).
 *
 * Prefer SMS first (user-requested; WhatsApp templates often fail on Sendmator).
 * Do NOT use Sendmator /otp/send for WhatsApp — it returns success without delivery.
 *
 * Order: SMS → Meta WA → Sendmator WA → email backup → Sendmator SMS OTP API → dev log.
 */
export async function deliverWhatsappOtp(
  to: string,
  code: string,
  opts?: { backupEmail?: string | null },
): Promise<
  | {
      ok: true;
      mode: OtpDeliveryMode;
      usesSendmator: boolean;
      sessionToken?: string;
      deliveredVia: string[];
    }
  | { ok: false; error: string }
> {
  const { logger } = await import("./logger");
  const deliveredVia: string[] = [];
  const masked = to.slice(0, 4) + "***";
  const backupEmail = opts?.backupEmail?.trim() || null;

  if (isSendmatorConfigured() && !isSendmatorSandbox()) {
    const {
      sendmatorSmsTemplateOtp,
      sendmatorWhatsappTemplateOtp,
      sendmatorDirectEmail,
      sendmatorOtpSend,
    } = await import("./sendmatorOtp");

    // 1) SMS first — most reliable for India (+91) and overseas mobiles
    const sms = await sendmatorSmsTemplateOtp(to, code);
    if (sms.ok) deliveredVia.push("sms");
    else {
      logger.warn({ error: sms.error, to: masked }, "Sendmator SMS template OTP failed");
    }

    // 2) Meta WhatsApp (optional)
    const meta = await sendWhatsappOtp({ to, code });
    if (meta?.ok && meta.mode === "meta") {
      deliveredVia.push("meta-whatsapp");
    }

    // 3) Sendmator WhatsApp template
    const wa = await sendmatorWhatsappTemplateOtp(to, code);
    if (wa.ok) deliveredVia.push("sendmator-whatsapp");
    else {
      logger.warn({ error: wa.error, to: masked }, "Sendmator WhatsApp template OTP failed");
    }

    // 4) Email backup with the SAME code
    if (backupEmail) {
      const emailed = await sendmatorDirectEmail({
        to: backupEmail,
        subject: "Your Karm Baba phone verification code",
        text: `Your Karm Baba verification code for ${to} is ${code}.\n\nIt expires in 15 minutes.\n\nIf you did not request this, ignore this email.`,
        html: `<p>Your Karm Baba verification code for <strong>${to}</strong> is:</p><p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p><p>It expires in 15 minutes. Check SMS / WhatsApp / this email.</p>`,
      });
      if (emailed.ok) deliveredVia.push("email");
      else {
        logger.warn({ error: emailed.error }, "Sendmator email backup for phone OTP failed");
      }
    }

    // 5) Last resort: Sendmator OTP API over SMS only (their code — switch to session verify)
    if (!deliveredVia.includes("sms")) {
      const otpSms = await sendmatorOtpSend("sms", to);
      if (otpSms.ok) {
        logger.info({ to: masked }, "Sendmator SMS OTP API accepted — using session verify");
        return {
          ok: true,
          mode: "sendmator",
          usesSendmator: true,
          sessionToken: otpSms.sessionToken,
          deliveredVia: [...deliveredVia, "sendmator-sms-otp"],
        };
      }
      logger.warn({ error: otpSms.error, to: masked }, "Sendmator SMS OTP API failed");
    }
  } else {
    const meta = await sendWhatsappOtp({ to, code });
    if (meta?.ok && meta.mode === "meta") deliveredVia.push("meta-whatsapp");
  }

  if (backupEmail && !deliveredVia.includes("email")) {
    const mailed = await sendMail({
      to: backupEmail,
      subject: "Your Karm Baba phone verification code",
      text: `Your Karm Baba verification code for ${to} is ${code}.\n\nIt expires in 15 minutes.`,
      html: `<p>Your Karm Baba verification code for <strong>${to}</strong> is:</p><p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p><p>It expires in 15 minutes.</p>`,
    });
    if (mailed.ok) deliveredVia.push(mailed.mode === "dev-log" ? "email-dev-log" : "email");
  }

  const isProd = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
  if (!isProd) {
    logger.info(
      { to: masked, code, deliveredVia },
      "Phone OTP code (dev) — enter this code on the verify form",
    );
    if (deliveredVia.length === 0) deliveredVia.push("dev-log");
  }

  if (deliveredVia.length === 0) {
    return {
      ok: false,
      error: backupEmail
        ? "Could not deliver the verification code by SMS, WhatsApp, or email. Try again shortly."
        : "Could not deliver SMS/WhatsApp code. Enter your company email first, then try again.",
    };
  }

  const mode: OtpDeliveryMode = deliveredVia.includes("sms") ||
    deliveredVia.includes("sendmator-whatsapp") ||
    deliveredVia.includes("email")
    ? "sendmator"
    : deliveredVia.includes("meta-whatsapp")
      ? "meta"
      : deliveredVia.includes("email-dev-log") || deliveredVia.includes("dev-log")
        ? "dev-log"
        : "sendmator";

  return {
    ok: true,
    mode,
    usesSendmator: false,
    deliveredVia,
  };
}

export async function confirmWhatsappOtp(
  userId: number,
  phone: string,
  code: string,
  storedHash: string | null | undefined,
): Promise<
  | { ok: true }
  | { ok: false; error: string; status: number; locked?: boolean }
> {
  const session = decodeSendmatorSession(storedHash);
  if (session) {
    const checked = await sendmatorOtpVerifyPhone(session, code);
    if (!checked.ok) {
      if (checked.invalid && !checked.locked) {
        const attempt = recordFailedOtpConfirm(userId, "whatsapp");
        if (attempt.locked) {
          return {
            ok: false,
            status: 429,
            locked: true,
            error: "Too many incorrect attempts — request a new code",
          };
        }
        const remaining =
          checked.attemptsRemaining ?? attempt.remaining;
        return {
          ok: false,
          status: 400,
          error: `Incorrect code — ${remaining} attempt(s) remaining`,
        };
      }
      return {
        ok: false,
        status: checked.locked ? 429 : 400,
        locked: checked.locked,
        error: checked.error,
      };
    }
    resetOtpConfirmAttempts(userId, "whatsapp");
    return { ok: true };
  }

  if (!verifyEmailOtpHash(code, phone, storedHash)) {
    const attempt = recordFailedOtpConfirm(userId, "whatsapp");
    if (attempt.locked) {
      return {
        ok: false,
        status: 429,
        locked: true,
        error: "Too many incorrect attempts — request a new code",
      };
    }
    return {
      ok: false,
      status: 400,
      error: `Incorrect code — ${attempt.remaining} attempt(s) remaining`,
    };
  }
  resetOtpConfirmAttempts(userId, "whatsapp");
  return { ok: true };
}
