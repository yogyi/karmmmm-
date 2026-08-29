import { logger } from "./logger";
import {
  getTwilioAuth,
  getTwilioVerifyServiceSid,
  isTwilioVerifyConfigured,
  twilioBasicAuthHeader,
} from "./twilioConfig";

export { isTwilioVerifyConfigured };

type VerifyChannel = "email" | "whatsapp" | "sms";

function parseTwilioError(body: string): string {
  try {
    const j = JSON.parse(body) as { message?: string; code?: number };
    if (j.message) return j.message;
  } catch {
    /* ignore */
  }
  return "Twilio Verify request failed";
}

/**
 * Start OTP delivery via Twilio Verify (email, WhatsApp, or SMS).
 * Twilio generates and sends the code — do not pass a custom code.
 */
export async function twilioVerifySend(
  to: string,
  channel: VerifyChannel,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = getTwilioAuth();
  const serviceSid = getTwilioVerifyServiceSid();
  if (!auth || !serviceSid) {
    return { ok: false, error: "Twilio Verify is not configured" };
  }

  try {
    const res = await fetch(
      `https://verify.twilio.com/v2/Services/${encodeURIComponent(serviceSid)}/Verifications`,
      {
        method: "POST",
        headers: {
          Authorization: twilioBasicAuthHeader(auth),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, Channel: channel }).toString(),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      logger.error({ status: res.status, channel, text }, "Twilio Verify send failed");
      return { ok: false, error: parseTwilioError(text) };
    }
    return { ok: true };
  } catch (err) {
    logger.error({ err, channel }, "Twilio Verify send error");
    return { ok: false, error: "Could not send verification code. Try again shortly." };
  }
}

/** Confirm a Twilio Verify OTP. */
export async function twilioVerifyCheck(
  to: string,
  code: string,
): Promise<
  | { ok: true }
  | { ok: false; error: string; invalid?: boolean; expired?: boolean }
> {
  const auth = getTwilioAuth();
  const serviceSid = getTwilioVerifyServiceSid();
  if (!auth || !serviceSid) {
    return { ok: false, error: "Twilio Verify is not configured" };
  }

  try {
    const res = await fetch(
      `https://verify.twilio.com/v2/Services/${encodeURIComponent(serviceSid)}/VerificationCheck`,
      {
        method: "POST",
        headers: {
          Authorization: twilioBasicAuthHeader(auth),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, Code: code }).toString(),
      },
    );
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      logger.warn({ status: res.status, text }, "Twilio Verify check failed");
      const msg = parseTwilioError(text);
      const lower = msg.toLowerCase();
      if (lower.includes("expired")) {
        return { ok: false, error: "Code expired — request a new one", expired: true };
      }
      return {
        ok: false,
        error: "Incorrect code — check and try again",
        invalid: true,
      };
    }

    let status = "";
    try {
      status = String((JSON.parse(text) as { status?: string }).status ?? "");
    } catch {
      /* ignore */
    }
    if (status && status !== "approved") {
      return { ok: false, error: "Incorrect code — check and try again", invalid: true };
    }
    return { ok: true };
  } catch (err) {
    logger.error({ err }, "Twilio Verify check error");
    return { ok: false, error: "Could not verify code. Try again shortly." };
  }
}
