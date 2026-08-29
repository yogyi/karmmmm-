/** Resolved Twilio REST credentials (API key preferred over legacy auth token). */
export type TwilioAuth = {
  accountSid: string;
  username: string;
  password: string;
};

export function twilioBasicAuthHeader(auth: Pick<TwilioAuth, "username" | "password">): string {
  return `Basic ${Buffer.from(`${auth.username}:${auth.password}`).toString("base64")}`;
}

/**
 * Twilio REST auth: API Key SID + secret (preferred), or Account SID + Auth Token.
 * Account SID is always required for resource URLs (/Accounts/{AccountSid}/…).
 */
export function getTwilioAuth(): TwilioAuth | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  if (!accountSid) return null;

  const apiKeySid =
    process.env.TWILIO_API_KEY_SID?.trim() || process.env.TWILIO_API_KEY?.trim();
  const apiKeySecret =
    process.env.TWILIO_API_KEY_SECRET?.trim() ||
    process.env.TWILIO_API_SECRET?.trim() ||
    process.env.TWILIO_AUTH_TOKEN?.trim();

  if (apiKeySid?.startsWith("SK") && apiKeySecret) {
    return { accountSid, username: apiKeySid, password: apiKeySecret };
  }

  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (authToken) {
    return { accountSid, username: accountSid, password: authToken };
  }

  return null;
}

export function getTwilioVerifyServiceSid(): string | null {
  return process.env.TWILIO_VERIFY_SERVICE_SID?.trim() || null;
}

export function isTwilioVerifyConfigured(): boolean {
  return getTwilioAuth() != null && getTwilioVerifyServiceSid() != null;
}
