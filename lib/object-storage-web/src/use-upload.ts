import { useState, useCallback } from "react";
import type { UppyFile } from "@uppy/core";
import { upload as blobClientUpload } from "@vercel/blob/client";

interface UploadMetadata {
  name: string;
  size: number;
  contentType: string;
}

interface UploadResponse {
  uploadURL: string;
  objectPath: string;
  metadata: UploadMetadata;
  /** Durable CDN URL when using Vercel Blob (prefer over /api/storage proxy). */
  publicUrl?: string;
}

export interface UseUploadOptions {
  /** Base path where object storage routes are mounted (default: "/api/storage") */
  basePath?: string;
  getToken?: () => Promise<string | null> | string | null;
  /** ACL on finalize — use private for KYC documents (default: public). */
  finalizeVisibility?: "public" | "private";
  onSuccess?: (response: UploadResponse) => void;
  onError?: (error: Error) => void;
}

function inferContentType(file: File): string {
  if (file.type && file.type !== "application/octet-stream") {
    return file.type;
  }
  const name = file.name.toLowerCase();
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".gif")) return "image/gif";
  if (name.endsWith(".pdf")) return "application/pdf";
  return file.type || "application/octet-stream";
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    if (data?.error) return data.error;
  } catch {
    // ignore
  }
  return `${fallback} (HTTP ${response.status})`;
}

function isBlobClientUploadUrl(uploadURL: string): boolean {
  return /\/api\/storage\/uploads\/blob-client\//i.test(uploadURL);
}

function objectIdFromBlobClientUrl(uploadURL: string): string | null {
  const match = uploadURL.match(/\/blob-client\/([0-9a-f-]{36})/i);
  return match?.[1] ?? null;
}

function blobHandleUploadUrl(basePath: string, uploadURL: string): string {
  try {
    const u = new URL(uploadURL);
    return `${u.origin}${basePath}/uploads/blob`;
  } catch {
    return `${basePath}/uploads/blob`;
  }
}

/**
 * React hook for handling file uploads with presigned URLs / Vercel Blob client upload.
 *
 * Flow:
 * 1. POST metadata → request-url
 * 2. PUT file to uploadURL (S3/GCS/local) OR Blob client upload (production)
 * 3. POST finalize (ACL / public visibility)
 */
export function useUpload(options: UseUploadOptions = {}) {
  const basePath = options.basePath ?? "/api/storage";
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState(0);

  const requestUploadUrl = useCallback(
    async (file: File): Promise<UploadResponse> => {
      const token = await options.getToken?.();
      const contentType = inferContentType(file);
      const response = await fetch(`${basePath}/uploads/request-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType,
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Failed to get upload URL"));
      }

      return response.json();
    },
    [basePath, options.getToken],
  );

  const uploadToPresignedUrl = useCallback(
    async (file: File, uploadURL: string): Promise<void> => {
      const isAppUpload =
        uploadURL.startsWith("/") ||
        uploadURL.includes("/api/storage/uploads/put/");
      const putUrl =
        isAppUpload && uploadURL.startsWith("http")
          ? (() => {
              try {
                const u = new URL(uploadURL);
                return `${u.pathname}${u.search}`;
              } catch {
                return uploadURL;
              }
            })()
          : uploadURL;
      const token = isAppUpload ? await options.getToken?.() : null;
      const contentType = inferContentType(file);
      const response = await fetch(putUrl, {
        method: "PUT",
        body: file,
        credentials: isAppUpload ? "include" : "omit",
        headers: {
          "Content-Type": contentType,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Failed to upload file to storage"));
      }
    },
    [options.getToken],
  );

  const uploadViaBlobClient = useCallback(
    async (file: File, uploadResponse: UploadResponse): Promise<void> => {
      const objectId = objectIdFromBlobClientUrl(uploadResponse.uploadURL);
      if (!objectId) {
        throw new Error("Invalid Blob client upload URL");
      }
      const token = await options.getToken?.();
      const contentType = inferContentType(file);
      const pathname = `private/uploads/${objectId}`;

      await blobClientUpload(pathname, file, {
        access: "public",
        handleUploadUrl: blobHandleUploadUrl(basePath, uploadResponse.uploadURL),
        clientPayload: JSON.stringify({
          objectPath: uploadResponse.objectPath,
          visibility: options.finalizeVisibility ?? "public",
        }),
        contentType,
        multipart: file.size > 4 * 1024 * 1024,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        onUploadProgress: (event) => {
          // Map 30–75% of overall bar to Blob transfer.
          const pct = Math.round(30 + (event.percentage ?? 0) * 0.45);
          setProgress(pct);
        },
      });
    },
    [basePath, options.getToken, options.finalizeVisibility],
  );

  const uploadFile = useCallback(
    async (file: File): Promise<UploadResponse> => {
      setIsUploading(true);
      setError(null);
      setProgress(0);

      try {
        setProgress(10);
        const uploadResponse = await requestUploadUrl(file);

        setProgress(30);
        if (isBlobClientUploadUrl(uploadResponse.uploadURL)) {
          await uploadViaBlobClient(file, uploadResponse);
        } else {
          await uploadToPresignedUrl(file, uploadResponse.uploadURL);
        }

        setProgress(80);
        const token = await options.getToken?.();
        const finalizeRes = await fetch(`${basePath}/uploads/finalize`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: "include",
          body: JSON.stringify({
            objectPath: uploadResponse.objectPath,
            visibility: options.finalizeVisibility ?? "public",
          }),
        });
        if (!finalizeRes.ok) {
          throw new Error(await readErrorMessage(finalizeRes, "Failed to finalize upload"));
        }

        let publicUrl: string | undefined;
        try {
          const finalized = (await finalizeRes.json()) as { publicUrl?: string };
          if (typeof finalized.publicUrl === "string" && finalized.publicUrl.length > 0) {
            publicUrl = finalized.publicUrl;
          }
        } catch {
          // Older APIs may return empty body — keep proxy path.
        }

        setProgress(100);
        const result: UploadResponse = { ...uploadResponse, publicUrl };
        options.onSuccess?.(result);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Upload failed");
        const message =
          error.message === "Failed to fetch"
            ? "Upload could not reach storage (network/CORS). Refresh and try again — if this persists, redeploy after Blob + APP_URL are set."
            : error.message;
        const wrapped = new Error(message);
        setError(wrapped);
        options.onError?.(wrapped);
        throw wrapped;
      } finally {
        setIsUploading(false);
      }
    },
    [requestUploadUrl, uploadToPresignedUrl, uploadViaBlobClient, options, basePath],
  );

  const getUploadParameters = useCallback(
    async (
      file: UppyFile<Record<string, unknown>, Record<string, unknown>>,
    ): Promise<{
      method: "PUT";
      url: string;
      headers?: Record<string, string>;
    }> => {
      const fakeFile = {
        name: file.name || "upload.bin",
        size: file.size || 0,
        type: file.type || "application/octet-stream",
      } as File;
      const contentType = inferContentType(fakeFile);
      const response = await fetch(`${basePath}/uploads/request-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          name: fakeFile.name,
          size: fakeFile.size,
          contentType,
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Failed to get upload URL"));
      }

      const data = await response.json();
      return {
        method: "PUT",
        url: data.uploadURL,
        headers: { "Content-Type": contentType },
      };
    },
    [basePath],
  );

  return {
    uploadFile,
    getUploadParameters,
    isUploading,
    error,
    progress,
  };
}
