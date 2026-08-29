import { describe, expect, it } from "vitest";
import {
  isCompleteOtpCode,
  normalizeOtpCode,
  otpPasteTransformer,
} from "@/lib/otpInput";

describe("normalizeOtpCode", () => {
  it("keeps a clean 6-digit code left-aligned", () => {
    expect(normalizeOtpCode("025355")).toBe("025355");
  });

  it("strips spaces and dashes from common SMS paste formats", () => {
    expect(normalizeOtpCode("025 355")).toBe("025355");
    expect(normalizeOtpCode("025-355")).toBe("025355");
    expect(normalizeOtpCode("0-2-5-3-5-5")).toBe("025355");
  });

  it("extracts digits from sentences and leading junk (regression: misaligned paste)", () => {
    expect(normalizeOtpCode("Your code is 025355")).toBe("025355");
    expect(normalizeOtpCode("\n025355")).toBe("025355");
    expect(normalizeOtpCode("\u200b025355")).toBe("025355");
    expect(normalizeOtpCode(" 025355 ")).toBe("025355");
    // Leading non-digit must not leave slot 0 empty while shifting digits right
    expect(normalizeOtpCode("x02535")).toBe("02535");
    expect(normalizeOtpCode("x025355")).toBe("025355");
  });

  it("truncates to maxLength from the left", () => {
    expect(normalizeOtpCode("02535599")).toBe("025355");
    expect(normalizeOtpCode("12-34-56-78", 4)).toBe("1234");
  });

  it("returns empty for non-digit paste", () => {
    expect(normalizeOtpCode("abcdef")).toBe("");
    expect(normalizeOtpCode("")).toBe("");
  });
});

describe("otpPasteTransformer", () => {
  it("matches normalize for clipboard payloads", () => {
    expect(otpPasteTransformer("Code: 025-355\n")).toBe("025355");
  });
});

describe("isCompleteOtpCode", () => {
  it("requires exactly maxLength digits", () => {
    expect(isCompleteOtpCode("025355")).toBe(true);
    expect(isCompleteOtpCode("02535")).toBe(false);
    expect(isCompleteOtpCode("0253557")).toBe(false);
    expect(isCompleteOtpCode("02a355")).toBe(false);
  });
});
