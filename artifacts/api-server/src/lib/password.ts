import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const KEY_LEN = 64;
const PREFIX = "scrypt";

/** Hash a password for storage. Never store the plain text. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, KEY_LEN)) as Buffer;
  return `${PREFIX}$${salt}$${derived.toString("hex")}`;
}

/** Verify a password against a stored scrypt hash only (no plaintext fallback). */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  if (!stored?.startsWith(`${PREFIX}$`)) {
    return false;
  }

  const [, salt, hash] = stored.split("$");
  if (!salt || !hash) return false;

  const derived = (await scryptAsync(password, salt, KEY_LEN)) as Buffer;
  const expected = Buffer.from(hash, "hex");
  if (expected.length !== derived.length) {
    return false;
  }

  return timingSafeEqual(derived, expected);
}
