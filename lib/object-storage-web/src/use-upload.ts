import { useState, useCallback } from "react";
import type { UppyFile } from "@uppy/core";

interface UploadMetadata {
  name: string;
  size: number;
  contentType: string;
}

interface UploadResponse {
  uploadURL: string;
  objectPath: string;
  metadata: UploadMetadata;
}

export interface UseUploadOptions {
  /** Base path where object storage routes are mounted (default: "/api/storage") */
  basePath?: string;
  getToken?: () => Promise<string | null> | string | null;
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

/**
 * React hook for handling file uploads with presigned URLs.
 *
 * Flow:
 * 1. POST metadata → request-url
 * 2. PUT file to uploadURL
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
        uploadURL.startsWith("/") || uploadURL.includes("/api/storage/uploads/put/");
      const token = isAppUpload ? await options.getToken?.() : null;
      const contentType = inferContentType(file);
      const response = await fetch(uploadURL, {
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

  const uploadFile = useCallback(
    async (file: File): Promise<UploadResponse> => {
      setIsUploading(true);
      setError(null);
      setProgress(0);

      try {
        setProgress(10);
        const uploadResponse = await requestUploadUrl(file);

        setProgress(30);
        await uploadToPresignedUrl(file, uploadResponse.uploadURL);

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
            visibility: "public",
          }),
        });
        if (!finalizeRes.ok) {
          throw new Error(await readErrorMessage(finalizeRes, "Failed to finalize upload"));
        }

        setProgress(100);
        options.onSuccess?.(uploadResponse);
        return uploadResponse;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Upload failed");
        setError(error);
        options.onError?.(error);
        throw error;
      } finally {
        setIsUploading(false);
      }
    },
    [requestUploadUrl, uploadToPresignedUrl, options, basePath],
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
