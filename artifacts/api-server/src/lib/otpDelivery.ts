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
  isSendmatorSession,
  sendmatorOtpSend,
  sendmatorOtpVerify,
  type SendmatorChannel,
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
      previewCode?: string;
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
        ...(sent.previewCode ? { previewCode: sent.previewCode } : {}),
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
  return {
    ok: true,
    mode: sent.mode,
    usesSendmator: false,
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

export async function deliverWhatsappOtp(
  to: string,
  code: string,
): Promise<
  | {
      ok: true;
      mode: OtpDeliveryMode;
      usesSendmator: boolean;
      sessionToken?: string;
      previewCode?: string;
    }
  | { ok: false; error: string }
> {
  if (isSendmatorConfigured()) {
    const sent = await sendmatorOtpSend("whatsapp", to);
    if (sent.ok) {
      return {
        ok: true,
        mode: "sendmator",
        usesSendmator: true,
        sessionToken: sent.sessionToken,
        ...(sent.previewCode ? { previewCode: sent.previewCode } : {}),
      };
    }
    return sent;
  }

  const sent = await sendWhatsappOtp({ to, code });
  if (!sent.ok) return sent;
  return {
    ok: true,
    mode: sent.mode,
    usesSendmator: false,
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
  const session = decodeSendmatorSession(storedHash);
  if (session) {
    const checked = await sendmatorOtpVerify(session, "whatsapp", code);
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
