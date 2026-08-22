import { describe, expect, it } from "vitest";
import {
  MAX_UPLOAD_BYTES,
  assertUploadMetadata,
  isOwnedUploadObjectPath,
} from "./uploadLimits";

describe("uploadLimits", () => {
  it("rejects oversized and bad MIME", () => {
    expect(
      assertUploadMetadata({ size: MAX_UPLOAD_BYTES + 1, contentType: "image/png" }).ok,
    ).toBe(false);
    expect(assertUploadMetadata({ size: 100, contentType: "text/html" }).ok).toBe(false);
    expect(assertUploadMetadata({ size: 100, contentType: "image/png" }).ok).toBe(true);
  });

  it("only allows upload UUID paths for finalize", () => {
    expect(
      isOwnedUploadObjectPath("/objects/uploads/550e8400-e29b-41d4-a716-446655440000"),
    ).toBe(true);
    expect(isOwnedUploadObjectPath("/objects/other/secret")).toBe(false);
    expect(isOwnedUploadObjectPath("/objects/uploads/not-a-uuid")).toBe(false);
  });
});
