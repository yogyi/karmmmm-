import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { ObjectPermission, getObjectAclPolicy } from "../lib/objectAcl";
import { getClerkUserId, requireClerkAuth } from "../lib/auth";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

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

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Then uploads the file directly to the returned presigned URL.
 */
router.post("/storage/uploads/request-url", requireClerkAuth, async (req: Request, res: Response) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  try {
    const { name, size, contentType } = parsed.data;

    const { uploadURL, objectPath } =
      await objectStorageService.getObjectEntityUploadURL();

    res.json(
      RequestUploadUrlResponse.parse({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      }),
    );
  } catch (error) {
    req.log.error(
      { err: error, driver: objectStorageService.getDriver() },
      "Error generating upload URL",
    );
    res.status(500).json({
      error:
        "Failed to generate upload URL. Check OBJECT_STORAGE_DRIVER and cloud credentials.",
    });
  }
});

/**
 * POST /storage/uploads/finalize
 *
 * After a successful PUT to the presigned URL, set ACL so only the uploader
 * (and public-read if requested) can download via /storage/objects/*.
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

  try {
    const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
      parsed.objectPath,
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

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
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
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
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
