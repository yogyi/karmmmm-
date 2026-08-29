/** Digits-only OTP helpers shared by InputOTP and verify flows. */

export const OTP_DEFAULT_LENGTH = 6;

/**
 * Normalize pasted or typed OTP text into a contiguous digit string.
 * Strips spaces, dashes, emails, and other clipboard junk so paste fills
 * slots from the left: "025-355", "code: 025355", "\n025355 " → "025355".
 */
export function normalizeOtpCode(
  raw: string,
  maxLength: number = OTP_DEFAULT_LENGTH,
): string {
  if (!raw) return "";
  const digits = String(raw).replace(/\D/g, "");
  if (maxLength <= 0) return "";
  return digits.slice(0, maxLength);
}

/** input-otp `pasteTransformer` — always run so desktop paste is handled. */
export function otpPasteTransformer(pasted: string): string {
  return normalizeOtpCode(pasted, OTP_DEFAULT_LENGTH);
}

export function isCompleteOtpCode(
  value: string,
  maxLength: number = OTP_DEFAULT_LENGTH,
): boolean {
  return new RegExp(`^\\d{${maxLength}}$`).test(value);
}
