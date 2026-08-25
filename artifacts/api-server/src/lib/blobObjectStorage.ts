import { Readable } from "node:stream";
import { put, head, list } from "@vercel/blob";
import type { StoredObject } from "./objectStorageBackend";

function token(): string {
  const t = process.env.BLOB_READ_WRITE_TOKEN;
  if (!t) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN is required for OBJECT_STORAGE_DRIVER=blob. " +
        "In Vercel: Storage → Blob → Connect to project (token is injected automatically).",
    );
  }
  return t;
}

type BlobMeta = {
  contentType: string;
  url: string;
};

function metaKey(objectName: string): string {
  return `${objectName}.meta.json`;
}

function aclKey(objectName: string): string {
  return `${objectName}.acl.json`;
}

async function readJsonBlob<T>(pathname: string): Promise<T | null> {
  try {
    const exact = await findExactBlob(pathname);
    if (!exact) return null;
    const res = await fetch(exact.url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function findExactBlob(
  pathname: string,
): Promise<{ url: string; contentType?: string } | null> {
  const { blobs } = await list({
    prefix: pathname,
    limit: 20,
    token: token(),
  });
  const exact = blobs.find((b) => b.pathname === pathname);
  if (!exact) return null;
  return { url: exact.url, contentType: undefined };
}

/** Persist CDN URL so later GET/finalize does not depend on list timing. */
export async function writeBlobMeta(
  objectName: string,
  meta: BlobMeta,
): Promise<void> {
  await put(metaKey(objectName), JSON.stringify(meta), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    token: token(),
  });
}

async function resolveMeta(objectName: string): Promise<BlobMeta | null> {
  const existing = await readJsonBlob<BlobMeta>(metaKey(objectName));
  if (existing?.url) return existing;

  const blob = await findExactBlob(objectName);
  if (!blob?.url) return null;

  const meta: BlobMeta = {
    contentType: blob.contentType || "application/octet-stream",
    url: blob.url,
  };
  try {
    await writeBlobMeta(objectName, meta);
  } catch {
    // Best-effort; still return resolved meta for this request.
  }
  return meta;
}

export class BlobStoredObject implements StoredObject {
  constructor(
    readonly bucketName: string,
    readonly objectName: string,
  ) {}

  private async meta(): Promise<BlobMeta | null> {
    return resolveMeta(this.objectName);
  }

  async exists(): Promise<boolean> {
    const meta = await this.meta();
    if (!meta?.url) return false;
    try {
      await head(meta.url, { token: token() });
      return true;
    } catch {
      return false;
    }
  }

  async createReadStream(): Promise<Readable> {
    const meta = await this.meta();
    if (!meta?.url) throw new Error("Blob object meta missing");
    const res = await fetch(meta.url);
    if (!res.ok || !res.body) {
      throw new Error(`Failed to read blob (${res.status})`);
    }
    return Readable.fromWeb(res.body as import("stream/web").ReadableStream);
  }

  async getContentInfo(): Promise<{ contentType: string; size?: string }> {
    const meta = await this.meta();
    if (!meta) return { contentType: "application/octet-stream" };
    try {
      const info = await head(meta.url, { token: token() });
      return {
        contentType: info.contentType || meta.contentType || "application/octet-stream",
        size: info.size != null ? String(info.size) : undefined,
      };
    } catch {
      return { contentType: meta.contentType || "application/octet-stream" };
    }
  }

  async getAclPolicyJson(): Promise<string | null> {
    const acl = await readJsonBlob<{ raw?: string } | string>(aclKey(this.objectName));
    if (!acl) return null;
    if (typeof acl === "string") return acl;
    if (typeof acl.raw === "string") return acl.raw;
    return JSON.stringify(acl);
  }

  async setAclPolicyJson(json: string): Promise<void> {
    await put(aclKey(this.objectName), json, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      token: token(),
    });
  }

  /** Public CDN URL for redirects (product images). */
  async getPublicUrl(): Promise<string | null> {
    const meta = await this.meta();
    return meta?.url ?? null;
  }
}

export async function writeBlobObject(
  objectName: string,
  body: Buffer,
  contentType: string,
): Promise<{ url: string }> {
  const result = await put(objectName, body, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType,
    token: token(),
  });

  await writeBlobMeta(objectName, { contentType, url: result.url });

  return { url: result.url };
}

export function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/** Pathname used for Vercel Blob client uploads (matches finalize object key). */
export function blobUploadPathname(objectId: string): string {
  return `private/uploads/${objectId}`;
}

export function isBlobUploadPathname(pathname: string): boolean {
  return /^private\/uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    pathname,
  );
}
