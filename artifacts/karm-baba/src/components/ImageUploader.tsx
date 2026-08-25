import { useRef, useState } from "react";
import { useUpload } from "@workspace/object-storage-web";
import { useAuth as useClerkAuth } from "@clerk/react";
import { Upload, X, ImageIcon, Loader2 } from "lucide-react";

interface ImageUploaderProps {
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
}

/**
 * Decode + recompress to JPEG so HEIC/odd phone MIME types become
 * `image/jpeg` before hitting the storage allowlist.
 */
async function fileToJpegFile(file: File, maxEdge = 1600, quality = 0.85): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not process image");
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Could not compress image"))),
        "image/jpeg",
        quality,
      );
    });
    const base = file.name.replace(/\.[^.]+$/, "") || "product";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}

export function ImageUploader({ images, onChange, maxImages = 5 }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [localBusy, setLocalBusy] = useState(false);
  const { getToken } = useClerkAuth();

  const { uploadFile, isUploading, progress } = useUpload({
    getToken,
  });

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const looksLikeImage =
      file.type.startsWith("image/") ||
      /\.(jpe?g|png|webp|gif|heic|heif|avif)$/i.test(file.name);
    if (!looksLikeImage) {
      setUploadError("Only image files are allowed");
      return;
    }
    if (images.length >= maxImages) {
      setUploadError(`You can upload up to ${maxImages} images`);
      return;
    }

    setUploadError(null);
    setLocalBusy(true);
    try {
      let toUpload: File;
      try {
        toUpload = await fileToJpegFile(file);
      } catch {
        if (!file.type.startsWith("image/") || file.type.includes("heic") || file.type.includes("heif")) {
          throw new Error("Could not read this image. Please use JPEG or PNG.");
        }
        toUpload = file;
      }

      const uploaded = await uploadFile(toUpload);
      const servingUrl = `/api/storage${uploaded.objectPath}`;
      onChange([...images, servingUrl]);
      setUploadError(null);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLocalBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function removeImage(idx: number) {
    onChange(images.filter((_, i) => i !== idx));
  }

  const busy = isUploading || localBusy;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {images.map((url, i) => (
          <div
            key={`${url}-${i}`}
            className="relative group w-20 h-20 rounded-lg border border-border overflow-hidden bg-muted"
          >
            <img src={url} alt={`Product image ${i + 1}`} className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => removeImage(i)}
              className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
            >
              <X size={16} className="text-white" />
            </button>
          </div>
        ))}

        {images.length < maxImages && (
          <button
            type="button"
            onClick={() => !busy && inputRef.current?.click()}
            disabled={busy}
            className="w-20 h-20 rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-colors flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span className="text-xs">{isUploading ? `${progress}%` : "…"}</span>
              </>
            ) : (
              <>
                <Upload size={18} />
                <span className="text-xs">Upload</span>
              </>
            )}
          </button>
        )}

        {images.length === 0 && !busy && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <ImageIcon size={14} />
            <span>No images yet — upload up to {maxImages}</span>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif"
        className="hidden"
        onChange={(e) => void handleFiles(e)}
      />

      {uploadError && <p className="text-sm text-red-500">{uploadError}</p>}
    </div>
  );
}
