import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import {
  ObjectPermission,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "../lib/objectAcl";
import { getClerkUserId, requireClerkAuth } from "../lib/auth";
import { getObjectStorageDriver, getStoredObject } from "../lib/objectStorageBackend";
import { writeLocalObject } from "../lib/localObjectStorage";
import {
  writeBlobObject,
  writeBlobMeta,
  isBlobConfigured,
  isBlobUploadPathname,
  blobUploadPathname,
} from "../lib/blobObjectStorage";
import {
  MAX_UPLOAD_BYTES,
  assertUploadMetadata,
  isAllowedUploadMime,
  isOwnedUploadObjectPath,
} from "../lib/uploadLimits";
import express from "express";

const router: IRouter = Router();
export const storagePublicRouter: IRouter = Router();
const objectStorageService = new ObjectStorageService();

const BLOB_ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
];

function parseFinalizeBody(body: unknown): {
  objectPath: string;
  visibility: "public" | "private";
} | null {
  if (!body || typeof body !== "object") return null;
  const objectPath = (body as { objectPath?: unknown }).objectPath;
  const visibilityRaw = (body as { visibility?: unknown }).visibility;
  if (typeof objectPath !== "string" || objectPath.length === 0) return null;
  const visibility =
    visibilityRaw === "public" || visibilityRaw === "private"
      ? visibilityRaw
      : "private";
  return { objectPath, visibility };
}

function isDirectPutDriver(driver: string): boolean {
  return driver === "local" || driver === "blob";
}

/** Absolute origin so Zod `.url()` accepts uploadURL (relative paths fail). */
function publicApiOrigin(req: Request): string {
  const xfProto = req.get("x-forwarded-proto");
  const xfHost = req.get("x-forwarded-host");
  if (xfProto && xfHost) {
    return `${xfProto.split(",")[0]!.trim()}://${xfHost.split(",")[0]!.trim()}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  const host = req.get("host");
  if (host) {
    return `${req.protocol}://${host}`;
  }
  return "http://localhost:3000";
}

function toAbsoluteUploadUrl(req: Request, uploadURL: string): string {
  if (/^https?:\/\//i.test(uploadURL)) return uploadURL;
  const path = uploadURL.startsWith("/") ? uploadURL : `/${uploadURL}`;
  return `${publicApiOrigin(req)}${path}`;
}

async function getObjectEntityFileWithRetry(
  objectPath: string,
  attempts = 8,
): Promise<Awaited<ReturnType<ObjectStorageService["getObjectEntityFile"]>>> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await objectStorageService.getObjectEntityFile(objectPath);
    } catch (error) {
      last = error;
      if (!(error instanceof ObjectNotFoundError)) throw error;
      await new Promise((r) => setTimeout(r, 120 * (i + 1)));
    }
  }
  throw last instanceof Error ? last : new ObjectNotFoundError();
}

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Then uploads the file directly to the returned upload URL (or Blob client flow).
 */
router.post("/storage/uploads/request-url", requireClerkAuth, async (req: Request, res: Response) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  const bounds = assertUploadMetadata(parsed.data);
  if (!bounds.ok) {
    res.status(400).json({ error: bounds.error });
    return;
  }

  try {
    const driver = getObjectStorageDriver();
    if (driver === "blob" && !isBlobConfigured()) {
      res.status(503).json({
        error:
          "Vercel Blob is not linked. In Vercel → Storage → create/connect Blob, then redeploy (BLOB_READ_WRITE_TOKEN).",
      });
      return;
    }

    const { name, size, contentType } = parsed.data;

    const { uploadURL, objectPath } =
      await objectStorageService.getObjectEntityUploadURL({ contentType });

    const payload = {
      uploadURL: toAbsoluteUploadUrl(req, uploadURL),
      objectPath,
      metadata: { name, size, contentType },
    };

    // Never throw 500 on OpenAPI Zod .url() quirks — return a usable payload.
    const checked = RequestUploadUrlResponse.safeParse(payload);
    if (!checked.success) {
      req.log.warn(
        { issues: checked.error.issues, uploadURL: payload.uploadURL },
        "Upload URL response failed schema check — returning absolute URL anyway",
      );
    }
    res.json(payload);
  } catch (error) {
    req.log.error(
      { err: error, driver: objectStorageService.getDriver() },
      "Error generating upload URL",
    );
    const driver = getObjectStorageDriver();
    res.status(500).json({
      error:
        driver === "blob" && !isBlobConfigured()
          ? "Vercel Blob is not linked. In Vercel → Storage → create/connect Blob, then redeploy (BLOB_READ_WRITE_TOKEN)."
          : driver === "local"
            ? `Failed to prepare local upload (${error instanceof Error ? error.message : "unknown error"}). Restart the API with: pnpm --filter @workspace/api-server run dev`
            : `Failed to generate upload URL (driver=${driver}). Check OBJECT_STORAGE_DRIVER and cloud credentials.`,
    });
  }
});

/**
 * POST /storage/uploads/blob
 *
 * Vercel Blob client-upload token exchange (handleUpload).
 * Browser uploads bytes straight to Blob — avoids the ~4.5MB serverless body limit.
 * Do NOT wrap with requireClerkAuth: Vercel Blob also POSTs upload-completed webhooks here.
 * Auth is enforced in onBeforeGenerateToken for token issuance only.
 */
router.post("/storage/uploads/blob", async (req: Request, res: Response) => {
  if (getObjectStorageDriver() !== "blob") {
    res.status(400).json({ error: "Blob client uploads require OBJECT_STORAGE_DRIVER=blob" });
    return;
  }
  if (!isBlobConfigured()) {
    res.status(503).json({
      error:
        "Vercel Blob is not configured. Connect a Blob store to this project (BLOB_READ_WRITE_TOKEN), then redeploy.",
    });
    return;
  }

  try {
    const body = req.body as HandleUploadBody;
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const userId = await getClerkUserId(req);
        if (!userId) {
          throw new Error("Authentication required");
        }
        if (!isBlobUploadPathname(pathname)) {
          throw new Error("Invalid upload pathname");
        }
        const objectPath =
          typeof clientPayload === "string" && clientPayload.length > 0
            ? clientPayload
            : `/objects/uploads/${pathname.split("/").pop()}`;
        if (!isOwnedUploadObjectPath(objectPath)) {
          throw new Error("Invalid objectPath in clientPayload");
        }
        const expected = blobUploadPathname(objectPath.split("/").pop()!);
        if (pathname !== expected) {
          throw new Error("objectPath does not match upload pathname");
        }
        return {
          allowedContentTypes: BLOB_ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: false,
          allowOverwrite: true,
          tokenPayload: JSON.stringify({ userId, objectPath }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        try {
          await writeBlobMeta(blob.pathname, {
            contentType: blob.contentType || "application/octet-stream",
            url: blob.url,
          });
          if (tokenPayload) {
            const parsed = JSON.parse(tokenPayload) as {
              userId?: string;
              objectPath?: string;
            };
            if (parsed.userId) {
              const object = getStoredObject("karmbaba-blob", blob.pathname);
              await setObjectAclPolicy(object, {
                owner: parsed.userId,
                visibility: "public",
              });
            }
          }
        } catch (err) {
          req.log.error({ err, pathname: blob.pathname }, "blob onUploadCompleted failed");
          // Client finalize is the safety net — don't fail the webhook forever.
        }
      },
    });
    res.json(jsonResponse);
  } catch (error) {
    req.log.error({ err: error }, "Error in blob handleUpload");
    res.status(400).json({
      error: error instanceof Error ? error.message : "Blob upload authorization failed",
    });
  }
});

/**
 * POST /storage/uploads/finalize
 *
 * After a successful PUT / Blob client upload, set ACL so only the uploader
 * (and public-read if requested) can download via /storage/objects/*.
 * Restricted to /objects/uploads/<uuid>; cannot steal another owner's ACL.
 */
router.post("/storage/uploads/finalize", requireClerkAuth, async (req: Request, res: Response) => {
  const parsed = parseFinalizeBody(req.body);
  if (!parsed) {
    res.status(400).json({ error: "Missing or invalid objectPath" });
    return;
  }

  const userId = await getClerkUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const normalized = objectStorageService.normalizeObjectEntityPath(parsed.objectPath);
  if (!isOwnedUploadObjectPath(normalized)) {
    res.status(400).json({
      error: "objectPath must be an upload issued by request-url (/objects/uploads/<id>)",
    });
    return;
  }

  try {
    const objectFile = await getObjectEntityFileWithRetry(normalized);
    const existingAcl = await getObjectAclPolicy(objectFile);
    if (existingAcl && existingAcl.owner !== userId) {
      res.status(403).json({ error: "Forbidden — object belongs to another user" });
      return;
    }

    const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
      normalized,
      {
        owner: userId,
        visibility: parsed.visibility,
      },
    );
    res.json({ objectPath, visibility: parsed.visibility });
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Object not found — upload may not have completed" });
      return;
    }
    req.log.error({ err: error }, "Error finalizing upload ACL");
    res.status(500).json({ error: "Failed to finalize upload" });
  }
});

/** Local-disk PUT target (and emergency Blob proxy for small files). */
router.put(
  "/storage/uploads/put/:objectId",
  requireClerkAuth,
  express.raw({ type: "*/*", limit: `${MAX_UPLOAD_BYTES}b` }),
  async (req: Request, res: Response) => {
    const driver = getObjectStorageDriver();
    if (!isDirectPutDriver(driver)) {
      res.status(400).json({
        error: "Direct PUT uploads are only enabled for local or blob storage",
      });
      return;
    }
    if (driver === "blob" && !isBlobConfigured()) {
      res.status(503).json({
        error:
          "Vercel Blob is not configured. Connect a Blob store to this project (BLOB_READ_WRITE_TOKEN), then redeploy.",
      });
      return;
    }
    // Vercel serverless body limit ~4.5MB — refuse larger proxy uploads on Vercel.
    const vercelBodyCap = 4 * 1024 * 1024;
    if (driver === "blob" && process.env.VERCEL) {
      const len = Number(req.headers["content-length"] || 0);
      if (len > vercelBodyCap) {
        res.status(413).json({
          error:
            "File too large for proxy upload on Vercel. Use the Blob client upload flow (blob-client URL).",
        });
        return;
      }
    }
    const objectId = String(req.params.objectId || "").replace(/[^a-zA-Z0-9-]/g, "");
    if (!objectId) {
      res.status(400).json({ error: "Missing upload id" });
      return;
    }
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body ?? []);
    if (body.length === 0) {
      res.status(400).json({ error: "Empty file" });
      return;
    }
    if (body.length > MAX_UPLOAD_BYTES) {
      res.status(413).json({ error: `File too large (max ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB)` });
      return;
    }
    if (driver === "blob" && process.env.VERCEL && body.length > vercelBodyCap) {
      res.status(413).json({
        error:
          "File too large for proxy upload on Vercel. Use the Blob client upload flow (blob-client URL).",
      });
      return;
    }
    const contentType =
      typeof req.headers["content-type"] === "string"
        ? req.headers["content-type"]
        : "application/octet-stream";
    if (!isAllowedUploadMime(contentType)) {
      res.status(415).json({
        error: "Unsupported file type. Allowed: JPEG, PNG, WebP, GIF, PDF",
      });
      return;
    }

    const objectName = blobUploadPathname(objectId);
    if (driver === "blob") {
      await writeBlobObject(objectName, body, contentType.split(";")[0]!.trim());
    } else {
      await writeLocalObject("karmbaba-local", objectName, body, contentType);
    }
    res.status(200).json({ ok: true, objectPath: `/objects/uploads/${objectId}` });
  },
);

/**
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * Requires a Karm Baba session (same-origin Clerk cookie is enough for <img>).
 */
router.get("/storage/public-objects/*filePath", requireClerkAuth, async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorageService.downloadObject(file);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Private object entities — ACL enforced.
 * - visibility=public → readable without auth
 * - visibility=private / missing ACL → authenticated owner (or ACL rule) only
 */
storagePublicRouter.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

    const aclPolicy = await getObjectAclPolicy(objectFile);
    const userId = (await getClerkUserId(req)) ?? undefined;

    if (!aclPolicy) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    if (aclPolicy.visibility !== "public") {
      if (!userId) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
    }

    const canAccess = await objectStorageService.canAccessObjectEntity({
      userId,
      objectFile,
      requestedPermission: ObjectPermission.READ,
    });
    if (!canAccess) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    // Prefer CDN redirect for Vercel Blob public objects (fast product images).
    if (
      aclPolicy.visibility === "public" &&
      typeof objectFile.getPublicUrl === "function"
    ) {
      const publicUrl = await objectFile.getPublicUrl();
      if (publicUrl) {
        res.redirect(302, publicUrl);
        return;
      }
    }

    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
