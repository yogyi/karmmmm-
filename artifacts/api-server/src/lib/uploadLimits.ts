/** Max upload size (bytes). Matches local PUT limit. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

/** UUID v4-ish id from getObjectEntityUploadURL. */
const UPLOAD_OBJECT_PATH =
  /^\/objects\/uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isAllowedUploadMime(contentType: string): boolean {
  const base = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  return ALLOWED_MIME.has(base);
}

export function assertUploadMetadata(input: {
  size: number;
  contentType: string;
}): { ok: true } | { ok: false; error: string } {
  if (!Number.isFinite(input.size) || input.size < 1) {
    return { ok: false, error: "Invalid file size" };
  }
  if (input.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      error: `File too large (max ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB)`,
    };
  }
  if (!isAllowedUploadMime(input.contentType)) {
    return {
      ok: false,
      error: "Unsupported file type. Allowed: JPEG, PNG, WebP, GIF, PDF",
    };
  }
  return { ok: true };
}

/** Finalize may only touch paths issued by request-url (uploads/<uuid>). */
export function isOwnedUploadObjectPath(objectPath: string): boolean {
  return UPLOAD_OBJECT_PATH.test(objectPath);
}
