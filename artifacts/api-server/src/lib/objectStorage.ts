import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";
import {
  getObjectStorageDriver,
  getStoredObject,
  signPutObjectUrl,
  type StoredObject,
} from "./objectStorageBackend";

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    const paths = Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((path) => path.trim())
          .filter((path) => path.length > 0),
      ),
    );
    if (paths.length === 0) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Example: /my-bucket/public. " +
          "Configure OBJECT_STORAGE_DRIVER=gcs|s3|replit and credentials — see .env.example.",
      );
    }
    return paths;
  }

  getPrivateObjectDir(): string {
    if (getObjectStorageDriver() === "local") {
      return process.env.PRIVATE_OBJECT_DIR || "/karmbaba-local/private";
    }
    if (getObjectStorageDriver() === "blob") {
      return process.env.PRIVATE_OBJECT_DIR || "/karmbaba-blob/private";
    }
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Example: /my-bucket/private. " +
          "Configure OBJECT_STORAGE_DRIVER=blob|gcs|s3|replit and credentials — see .env.example.",
      );
    }
    return dir;
  }

  async searchPublicObject(filePath: string): Promise<StoredObject | null> {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath.replace(/\/$/, "")}/${filePath}`;
      const { bucketName, objectName } = parseObjectPath(fullPath);
      const object = getStoredObject(bucketName, objectName);
      if (await object.exists()) {
        return object;
      }
    }
    return null;
  }

  async downloadObject(
    object: StoredObject,
    cacheTtlSec: number = 3600,
  ): Promise<Response> {
    const info = await object.getContentInfo();
    const aclPolicy = await getObjectAclPolicy(object);
    const isPublic = aclPolicy?.visibility === "public";

    const nodeStream = await object.createReadStream();
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    const headers: Record<string, string> = {
      "Content-Type": info.contentType || "application/octet-stream",
      "Cache-Control": `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`,
    };
    if (info.size) {
      headers["Content-Length"] = info.size;
    }

    return new Response(webStream, { headers });
  }

  /**
   * Issue a presigned PUT URL and the stable app path to store in the DB.
   * Signing uses native GCS / S3(R2) credentials — Replit sidecar only when
   * OBJECT_STORAGE_DRIVER=replit (or auto-detected REPL_ID).
   */
  async getObjectEntityUploadURL(opts?: { contentType?: string }): Promise<{
    uploadURL: string;
    objectPath: string;
  }> {
    const privateObjectDir = this.getPrivateObjectDir();
    const objectId = randomUUID();
    const fullPath = `${privateObjectDir.replace(/\/$/, "")}/uploads/${objectId}`;
    const { bucketName, objectName } = parseObjectPath(fullPath);

    if (getObjectStorageDriver() === "blob") {
      // Marker URL — client uses @vercel/blob upload() → handleUpload (no 4.5MB function body).
      return {
        uploadURL: `/api/storage/uploads/blob-client/${objectId}`,
        objectPath: `/objects/uploads/${objectId}`,
      };
    }
    if (getObjectStorageDriver() === "local") {
      return {
        uploadURL: `/api/storage/uploads/put/${objectId}`,
        objectPath: `/objects/uploads/${objectId}`,
      };
    }

    const uploadURL = await signPutObjectUrl(
      bucketName,
      objectName,
      900,
      opts?.contentType,
    );
    return {
      uploadURL,
      objectPath: `/objects/uploads/${objectId}`,
    };
  }

  async getObjectEntityFile(objectPath: string): Promise<StoredObject> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    const parts = objectPath.slice(1).split("/");
    if (parts.length < 2) {
      throw new ObjectNotFoundError();
    }

    const entityId = parts.slice(1).join("/");
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith("/")) {
      entityDir = `${entityDir}/`;
    }
    const objectEntityPath = `${entityDir}${entityId}`;
    const { bucketName, objectName } = parseObjectPath(objectEntityPath);
    const object = getStoredObject(bucketName, objectName);
    if (!(await object.exists())) {
      throw new ObjectNotFoundError();
    }
    return object;
  }

  normalizeObjectEntityPath(rawPath: string): string {
    // Prefer explicit object paths from getObjectEntityUploadURL.
    if (rawPath.startsWith("/objects/")) {
      return rawPath;
    }

    try {
      const url = new URL(rawPath);
      const host = url.hostname;
      let rawObjectPath = url.pathname;

      // Virtual-hosted–style S3: bucket.s3.region.amazonaws.com/key
      if (host.includes(".amazonaws.com") && !host.startsWith("s3.")) {
        const bucket = host.split(".")[0];
        rawObjectPath = `/${bucket}${rawObjectPath}`;
      }

      let objectEntityDir = this.getPrivateObjectDir();
      if (!objectEntityDir.endsWith("/")) {
        objectEntityDir = `${objectEntityDir}/`;
      }

      if (!rawObjectPath.startsWith(objectEntityDir)) {
        return rawObjectPath;
      }

      const entityId = rawObjectPath.slice(objectEntityDir.length);
      return `/objects/${entityId}`;
    } catch {
      return rawPath;
    }
  }

  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy,
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith("/")) {
      return normalizedPath;
    }

    const object = await this.getObjectEntityFile(normalizedPath);
    await setObjectAclPolicy(object, aclPolicy);
    return normalizedPath;
  }

  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: StoredObject;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return canAccessObject({
      userId,
      object: objectFile,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }

  /** Helpful for logs / health. */
  getDriver(): string {
    return getObjectStorageDriver();
  }
}

function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }

  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");

  return {
    bucketName,
    objectName,
  };
}
