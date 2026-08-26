import { Storage, File } from "@google-cloud/storage";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
  type GetObjectCommandOutput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "node:stream";
import { LocalStoredObject } from "./localObjectStorage";
import { BlobStoredObject, isBlobConfigured } from "./blobObjectStorage";

export type ObjectStorageDriver = "gcs" | "s3" | "replit" | "local" | "blob";

const REPLIT_SIDECAR_ENDPOINT =
  process.env.REPLIT_SIDECAR_ENDPOINT || "http://127.0.0.1:1106";

const ACL_POLICY_METADATA_KEY = "custom:aclPolicy";

/** Backend-agnostic handle for one object (GCS File or S3 key). */
export interface StoredObject {
  readonly bucketName: string;
  readonly objectName: string;
  exists(): Promise<boolean>;
  createReadStream(): Promise<Readable>;
  getContentInfo(): Promise<{ contentType: string; size?: string }>;
  getAclPolicyJson(): Promise<string | null>;
  setAclPolicyJson(json: string): Promise<void>;
  /** Optional CDN URL (Vercel Blob) for direct redirects. */
  getPublicUrl?(): Promise<string | null>;
}

export function resolveObjectStorageDriver(): ObjectStorageDriver {
  const explicit = (process.env.OBJECT_STORAGE_DRIVER || "").toLowerCase();
  if (
    explicit === "gcs" ||
    explicit === "s3" ||
    explicit === "replit" ||
    explicit === "local" ||
    explicit === "blob"
  ) {
    return explicit;
  }
  // Prefer durable Blob when the store token is linked (Vercel or local with pulled env).
  if (isBlobConfigured()) {
    return "blob";
  }
  if (
    process.env.S3_BUCKET ||
    process.env.AWS_ACCESS_KEY_ID ||
    process.env.S3_ENDPOINT ||
    process.env.R2_ACCOUNT_ID
  ) {
    return "s3";
  }
  if (
    process.env.GCS_SERVICE_ACCOUNT_JSON ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.GCS_PROJECT_ID
  ) {
    return "gcs";
  }
  if (process.env.REPL_ID || process.env.REPL_SLUG) {
    return "replit";
  }
  // Local/dev: always use disk — never require Blob/S3 just because Vercel CLI set VERCEL=1.
  if (process.env.NODE_ENV !== "production") {
    return "local";
  }
  // Production on Vercel without a Blob token: select blob so upload fails with a clear setup error.
  if (process.env.VERCEL) {
    return "blob";
  }
  return "local";
}

let cachedDriver: ObjectStorageDriver | null = null;
let gcsClient: Storage | null = null;
let s3Client: S3Client | null = null;

/** Test helper — clears cached driver between cases. */
export function resetObjectStorageDriverCache(): void {
  cachedDriver = null;
}

export function getObjectStorageDriver(): ObjectStorageDriver {
  if (!cachedDriver) cachedDriver = resolveObjectStorageDriver();
  return cachedDriver;
}

export function createGcsClient(): Storage {
  if (gcsClient) return gcsClient;

  const driver = getObjectStorageDriver();
  if (driver === "replit") {
    gcsClient = new Storage({
      credentials: {
        audience: "replit",
        subject_token_type: "access_token",
        token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
        type: "external_account",
        credential_source: {
          url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
          format: {
            type: "json",
            subject_token_field_name: "access_token",
          },
        },
        universe_domain: "googleapis.com",
      },
      projectId: "",
    });
    return gcsClient;
  }

  const json = process.env.GCS_SERVICE_ACCOUNT_JSON;
  if (json) {
    const credentials = JSON.parse(json) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };
    gcsClient = new Storage({
      projectId: process.env.GCS_PROJECT_ID || credentials.project_id,
      credentials,
    });
    return gcsClient;
  }

  gcsClient = new Storage({
    projectId: process.env.GCS_PROJECT_ID || undefined,
  });
  return gcsClient;
}

export function createS3Client(): S3Client {
  if (s3Client) return s3Client;

  const accountId = process.env.R2_ACCOUNT_ID;
  const endpoint =
    process.env.S3_ENDPOINT ||
    (accountId
      ? `https://${accountId}.r2.cloudflarestorage.com`
      : undefined);

  s3Client = new S3Client({
    region: process.env.S3_REGION || process.env.AWS_REGION || "auto",
    endpoint,
    forcePathStyle:
      process.env.S3_FORCE_PATH_STYLE === "true" || Boolean(endpoint),
    credentials:
      process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          }
        : undefined,
  });
  return s3Client;
}

class GcsStoredObject implements StoredObject {
  constructor(
    readonly bucketName: string,
    readonly objectName: string,
    private readonly file: File,
  ) {}

  async exists(): Promise<boolean> {
    const [exists] = await this.file.exists();
    return exists;
  }

  async createReadStream(): Promise<Readable> {
    return this.file.createReadStream();
  }

  async getContentInfo(): Promise<{ contentType: string; size?: string }> {
    const [metadata] = await this.file.getMetadata();
    return {
      contentType: (metadata.contentType as string) || "application/octet-stream",
      size: metadata.size != null ? String(metadata.size) : undefined,
    };
  }

  async getAclPolicyJson(): Promise<string | null> {
    const [metadata] = await this.file.getMetadata();
    const raw = metadata?.metadata?.[ACL_POLICY_METADATA_KEY];
    return typeof raw === "string" ? raw : null;
  }

  async setAclPolicyJson(json: string): Promise<void> {
    await this.file.setMetadata({
      metadata: { [ACL_POLICY_METADATA_KEY]: json },
    });
  }
}

class S3StoredObject implements StoredObject {
  constructor(
    readonly bucketName: string,
    readonly objectName: string,
    private readonly client: S3Client,
  ) {}

  async exists(): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: this.objectName,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  async createReadStream(): Promise<Readable> {
    const out: GetObjectCommandOutput = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucketName,
        Key: this.objectName,
      }),
    );
    if (!out.Body) {
      throw new Error("S3 object has no body");
    }
    // AWS SDK v3 Body is a Readable in Node.
    return out.Body as Readable;
  }

  async getContentInfo(): Promise<{ contentType: string; size?: string }> {
    const out = await this.client.send(
      new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: this.objectName,
      }),
    );
    return {
      contentType: out.ContentType || "application/octet-stream",
      size: out.ContentLength != null ? String(out.ContentLength) : undefined,
    };
  }

  async getAclPolicyJson(): Promise<string | null> {
    const out = await this.client.send(
      new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: this.objectName,
      }),
    );
    // S3 user metadata keys are lowercased; we store without the custom: prefix mess.
    const meta = out.Metadata || {};
    return meta.aclpolicy || meta["custom:aclpolicy"] || null;
  }

  async setAclPolicyJson(json: string): Promise<void> {
    // S3 cannot patch metadata alone — copy onto self with REPLACE.
    const info = await this.getContentInfo();
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucketName,
        Key: this.objectName,
        CopySource: `${this.bucketName}/${encodeURIComponent(this.objectName).replace(/%2F/g, "/")}`,
        MetadataDirective: "REPLACE",
        Metadata: { aclpolicy: json },
        ContentType: info.contentType,
      }),
    );
  }
}

export function getStoredObject(
  bucketName: string,
  objectName: string,
): StoredObject {
  const driver = getObjectStorageDriver();
  if (driver === "local") {
    return new LocalStoredObject(bucketName, objectName);
  }
  if (driver === "blob") {
    return new BlobStoredObject(bucketName, objectName);
  }
  if (driver === "s3") {
    return new S3StoredObject(bucketName, objectName, createS3Client());
  }
  const file = createGcsClient().bucket(bucketName).file(objectName);
  return new GcsStoredObject(bucketName, objectName, file);
}

export async function signPutObjectUrl(
  bucketName: string,
  objectName: string,
  ttlSec: number,
  contentType?: string,
): Promise<string> {
  const driver = getObjectStorageDriver();

  if (driver === "replit") {
    return signViaReplitSidecar({
      bucketName,
      objectName,
      method: "PUT",
      ttlSec,
    });
  }

  if (driver === "s3") {
    const client = createS3Client();
    return getSignedUrl(
      client,
      new PutObjectCommand({
        Bucket: bucketName,
        Key: objectName,
        ...(contentType ? { ContentType: contentType } : {}),
      }),
      { expiresIn: ttlSec },
    );
  }

  // Native GCS V4 signed URL (works on Vercel / local with a service account).
  const file = createGcsClient().bucket(bucketName).file(objectName);
  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + ttlSec * 1000,
    ...(contentType ? { contentType } : {}),
  });
  return url;
}

async function signViaReplitSidecar({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method,
    expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
  };
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!response.ok) {
    throw new Error(
      `Replit sidecar signing failed (${response.status}). ` +
        `Set OBJECT_STORAGE_DRIVER=gcs|s3 with real credentials for Vercel/local.`,
    );
  }
  const { signed_url: signedURL } = (await response.json()) as {
    signed_url: string;
  };
  return signedURL;
}

export { ACL_POLICY_METADATA_KEY };
