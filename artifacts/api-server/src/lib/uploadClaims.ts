/**
 * In-memory + short-lived claims binding upload object IDs to Clerk user IDs.
 * Prevents authenticated callers from overwriting another user's pending UUID.
 */
type Claim = { userId: string; expiresAt: number };

const CLAIM_TTL_MS = 60 * 60 * 1000;
const claims = new Map<string, Claim>();

function sweep(now = Date.now()) {
  for (const [id, c] of claims) {
    if (c.expiresAt <= now) claims.delete(id);
  }
}

export function claimUploadObject(objectId: string, userId: string): void {
  sweep();
  const id = objectId.replace(/[^a-zA-Z0-9-]/g, "");
  if (!id || !userId) return;
  claims.set(id, { userId, expiresAt: Date.now() + CLAIM_TTL_MS });
}

export function getUploadClaimOwner(objectId: string): string | null {
  sweep();
  const id = objectId.replace(/[^a-zA-Z0-9-]/g, "");
  const c = claims.get(id);
  if (!c) return null;
  if (c.expiresAt <= Date.now()) {
    claims.delete(id);
    return null;
  }
  return c.userId;
}

export function assertUploadClaimOwner(objectId: string, userId: string): boolean {
  const owner = getUploadClaimOwner(objectId);
  if (owner == null) return false;
  return owner === userId;
}
