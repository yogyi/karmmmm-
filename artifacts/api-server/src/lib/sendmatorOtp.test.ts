import { describe, expect, it } from "vitest";
import {
  decodeSendmatorSession,
  encodeSendmatorSession,
  isSendmatorSession,
} from "./sendmatorOtp";

describe("sendmator session storage", () => {
  it("round-trips session token in otp hash field", () => {
    const token = "eyJhbGciOiJIUzI1NiJ9.test";
    const stored = encodeSendmatorSession(token);
    expect(stored.startsWith("sendmator:")).toBe(true);
    expect(decodeSendmatorSession(stored)).toBe(token);
    expect(isSendmatorSession(stored)).toBe(true);
  });

  it("returns null for local bcrypt-style hashes", () => {
    expect(decodeSendmatorSession("abc123deadbeef")).toBeNull();
    expect(isSendmatorSession(null)).toBe(false);
  });
});
