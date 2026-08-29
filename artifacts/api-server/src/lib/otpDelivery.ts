import {
  recordFailedOtpConfirm,
  resetOtpConfirmAttempts,
  verifyEmailOtpHash,
} from "./emailOtp";
import { sendMail } from "./mail";
import { isTwilioVerifyConfigured, twilioVerifyCheck, twilioVerifySend } from "./twilioVerify";
import { sendWhatsappOtp } from "./whatsappOtp";

export type OtpDeliveryMode = "twilio-verify" | "twilio" | "meta" | "resend" | "dev-log";

export async function deliverEmailOtp(
  email: string,
  code: string,
): Promise<
  | { ok: true; mode: OtpDeliveryMode; usesTwilioVerify: boolean; previewCode?: string }
  | { ok: false; error: string }
> {
  if (isTwilioVerifyConfigured()) {
    const sent = await twilioVerifySend(email, "email");
    if (sent.ok) {
      return { ok: true, mode: "twilio-verify", usesTwilioVerify: true };
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
  return {
    ok: true,
    mode: sent.mode,
    usesTwilioVerify: false,
    ...(sent.mode === "dev-log" ? { previewCode: code } : {}),
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
  if (isTwilioVerifyConfigured() && !storedHash) {
    const checked = await twilioVerifyCheck(email, code);
    if (!checked.ok) {
      if (checked.invalid) {
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
      return {
        ok: false,
        status: checked.expired ? 400 : 400,
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

export async function deliverWhatsappOtp(
  to: string,
  code: string,
): Promise<
  | { ok: true; mode: OtpDeliveryMode; usesTwilioVerify: boolean; previewCode?: string }
  | { ok: false; error: string }
> {
  if (isTwilioVerifyConfigured()) {
    const sent = await twilioVerifySend(to, "whatsapp");
    if (sent.ok) {
      return { ok: true, mode: "twilio-verify", usesTwilioVerify: true };
    }
    return sent;
  }

  const sent = await sendWhatsappOtp({ to, code });
  if (!sent.ok) return sent;
  return {
    ok: true,
    mode: sent.mode,
    usesTwilioVerify: false,
    ...(sent.mode === "dev-log" ? { previewCode: code } : {}),
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
  if (isTwilioVerifyConfigured() && !storedHash) {
    const checked = await twilioVerifyCheck(phone, code);
    if (!checked.ok) {
      if (checked.invalid) {
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
      return { ok: false, status: 400, error: checked.error };
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
