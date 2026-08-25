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
    const { blobs } = await list({
      prefix: pathname,
      limit: 5,
      token: token(),
    });
    const exact = blobs.find((b) => b.pathname === pathname);
    if (!exact) return null;
    const res = await fetch(exact.url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export class BlobStoredObject implements StoredObject {
  constructor(
    readonly bucketName: string,
    readonly objectName: string,
  ) {}

  private async meta(): Promise<BlobMeta | null> {
    return readJsonBlob<BlobMeta>(metaKey(this.objectName));
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

  await put(
    metaKey(objectName),
    JSON.stringify({ contentType, url: result.url } satisfies BlobMeta),
    {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      token: token(),
    },
  );

  return { url: result.url };
}

export function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}
