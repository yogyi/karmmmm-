/**
 * Prefer durable CDN URLs from Blob finalize; fall back to the API proxy path.
 * Local uploads that only lived on disk will 404 in production — callers should
 * re-upload, and UI should onError → initials/fallback.
 */
export function mediaUrlFromUpload(uploaded: {
  objectPath: string;
  publicUrl?: string;
}): string {
  if (uploaded.publicUrl && /^https?:\/\//i.test(uploaded.publicUrl)) {
    return uploaded.publicUrl;
  }
  return `/api/storage${uploaded.objectPath}`;
}

/** True when the URL is our storage proxy (may 404 if file was never on Blob). */
export function isAppStorageProxyUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.startsWith("/api/storage/") || url.includes("/api/storage/objects/");
}
