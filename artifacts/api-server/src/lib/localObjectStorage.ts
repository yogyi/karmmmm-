import { createReadStream, existsSync } from "node:fs";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import type { StoredObject } from "./objectStorageBackend";

const ROOT = path.resolve(
  process.env.LOCAL_OBJECT_DIR ||
    (process.env.VERCEL
      ? path.join("/tmp", "karmbaba-objects")
      : // Prefer repo-stable path when cwd is the api-server package during `pnpm dev`.
        path.join(process.cwd(), "data", "objects")),
);

function filePath(bucketName: string, objectName: string): string {
  const safeBucket = path.basename(bucketName.replace(/\\/g, "/"));
  const normalized = path.normalize(objectName.replace(/\\/g, "/"));
  if (
    !safeBucket ||
    safeBucket === "." ||
    safeBucket === ".." ||
    normalized.split("/").some((p) => p === "..") ||
    path.isAbsolute(normalized)
  ) {
    throw new Error("Invalid object path");
  }
  const dest = path.join(ROOT, safeBucket, normalized);
  const rootWithSep = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;
  if (dest !== ROOT && !dest.startsWith(rootWithSep)) {
    throw new Error("Invalid object path");
  }
  return dest;
}

function aclPath(bucketName: string, objectName: string): string {
  return `${filePath(bucketName, objectName)}.acl.json`;
}

function metaPath(bucketName: string, objectName: string): string {
  return `${filePath(bucketName, objectName)}.meta.json`;
}

export class LocalStoredObject implements StoredObject {
  constructor(
    readonly bucketName: string,
    readonly objectName: string,
  ) {}

  async exists(): Promise<boolean> {
    return existsSync(filePath(this.bucketName, this.objectName));
  }

  async createReadStream(): Promise<Readable> {
    return createReadStream(filePath(this.bucketName, this.objectName));
  }

  async getContentInfo(): Promise<{ contentType: string; size?: string }> {
    const metaRaw = existsSync(metaPath(this.bucketName, this.objectName))
      ? await readFile(metaPath(this.bucketName, this.objectName), "utf8")
      : "{}";
    const meta = JSON.parse(metaRaw) as { contentType?: string };
    const info = await stat(filePath(this.bucketName, this.objectName));
    return {
      contentType: meta.contentType || "application/octet-stream",
      size: String(info.size),
    };
  }

  async getAclPolicyJson(): Promise<string | null> {
    const p = aclPath(this.bucketName, this.objectName);
    if (!existsSync(p)) return null;
    return readFile(p, "utf8");
  }

  async setAclPolicyJson(json: string): Promise<void> {
    const p = aclPath(this.bucketName, this.objectName);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, json, "utf8");
  }
}

export async function writeLocalObject(
  bucketName: string,
  objectName: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const dest = filePath(bucketName, objectName);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, body);
  await writeFile(
    metaPath(bucketName, objectName),
    JSON.stringify({ contentType }),
    "utf8",
  );
}
