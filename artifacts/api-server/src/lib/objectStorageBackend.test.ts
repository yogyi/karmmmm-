import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { resolveObjectStorageDriver } from "./objectStorageBackend";

const KEYS = [
  "OBJECT_STORAGE_DRIVER",
  "S3_BUCKET",
  "AWS_ACCESS_KEY_ID",
  "S3_ENDPOINT",
  "R2_ACCOUNT_ID",
  "GCS_SERVICE_ACCOUNT_JSON",
  "GOOGLE_APPLICATION_CREDENTIALS",
  "GCS_PROJECT_ID",
  "REPL_ID",
  "REPL_SLUG",
] as const;

describe("resolveObjectStorageDriver", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it("honors explicit OBJECT_STORAGE_DRIVER", () => {
    process.env.OBJECT_STORAGE_DRIVER = "s3";
    expect(resolveObjectStorageDriver()).toBe("s3");
    process.env.OBJECT_STORAGE_DRIVER = "replit";
    expect(resolveObjectStorageDriver()).toBe("replit");
    process.env.OBJECT_STORAGE_DRIVER = "gcs";
    expect(resolveObjectStorageDriver()).toBe("gcs");
  });

  it("auto-selects s3 when R2/S3 env is present", () => {
    process.env.R2_ACCOUNT_ID = "abc";
    expect(resolveObjectStorageDriver()).toBe("s3");
  });

  it("auto-selects gcs when service account JSON is present", () => {
    process.env.GCS_SERVICE_ACCOUNT_JSON = "{}";
    expect(resolveObjectStorageDriver()).toBe("gcs");
  });

  it("auto-selects replit on REPL_ID", () => {
    process.env.REPL_ID = "xyz";
    expect(resolveObjectStorageDriver()).toBe("replit");
  });
});
