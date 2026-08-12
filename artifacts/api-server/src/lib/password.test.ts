import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("hashes and verifies a password", async () => {
    const hash = await hashPassword("demo123");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("demo123", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("rejects plaintext or unknown formats", async () => {
    expect(await verifyPassword("demo123", "demo123")).toBe(false);
    expect(await verifyPassword("demo123", "bcrypt$salt$hash")).toBe(false);
    expect(await verifyPassword("demo123", "scrypt$onlysalt")).toBe(false);
  });

  it("uses a unique salt per hash", async () => {
    const a = await hashPassword("same");
    const b = await hashPassword("same");
    expect(a).not.toBe(b);
  });
});
