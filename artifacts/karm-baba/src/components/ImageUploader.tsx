import { useRef, useState } from "react";
import { useUpload } from "@workspace/object-storage-web";
import { useAuth as useClerkAuth } from "@clerk/react";
import { Camera, ImageIcon, Loader2, Upload, X } from "lucide-react";
import { ImageSourcePicker } from "@/components/ImageSourcePicker";
import { normalizeProductImageFile } from "@/lib/normalizeProductImage";

interface ImageUploaderProps {
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
}

export function ImageUploader({ images, onChange, maxImages = 5 }: ImageUploaderProps) {
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [localBusy, setLocalBusy] = useState(false);
  const imagesRef = useRef(images);
  imagesRef.current = images;
  const { getToken } = useClerkAuth();

  const { uploadFile, isUploading, progress } = useUpload({
    getToken,
  });

  async function processAndUpload(file: File) {
    const looksLikeImage =
      file.type.startsWith("image/") ||
      file.type === "" ||
      /\.(jpe?g|png|webp|gif|heic|heif|avif)$/i.test(file.name);
    if (!looksLikeImage && file.type && !file.type.startsWith("image/")) {
      setUploadError("Only image files are allowed");
      return;
    }
    if (imagesRef.current.length >= maxImages) {
      setUploadError(`You can upload up to ${maxImages} images`);
      return;
    }

    setUploadError(null);
    setLocalBusy(true);
    try {
      let toUpload: File;
      try {
        toUpload = await normalizeProductImageFile(file);
      } catch {
        if (
          file.type &&
          (!file.type.startsWith("image/") ||
            file.type.includes("heic") ||
            file.type.includes("heif"))
        ) {
          throw new Error("Could not read this image. Please use JPEG or PNG.");
        }
        toUpload =
          file.type === "image/jpeg" || file.type === "image/jpg"
            ? file
            : new File([file], file.name || `photo-${Date.now()}.jpg`, {
                type: "image/jpeg",
              });
      }

      const uploaded = await uploadFile(toUpload);
      const servingUrl = `/api/storage${uploaded.objectPath}`;
      onChange([...imagesRef.current, servingUrl]);
      setUploadError(null);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
      // Don't rethrow — ImageSourcePicker already surfaces onError; rethrowing
      // only creates unhandled promise noise after a visible error.
    } finally {
      setLocalBusy(false);
    }
  }

  function removeImage(idx: number) {
    onChange(images.filter((_, i) => i !== idx));
  }

  const busy = isUploading || localBusy;
  const canAdd = images.length < maxImages;

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
              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/65 text-white flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
              aria-label={`Remove image ${i + 1}`}
            >
              <X size={12} />
            </button>
          </div>
        ))}

        {canAdd && (
          <ImageSourcePicker
            disabled={busy}
            preferEnvironment
            accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif"
            onFile={(file) => processAndUpload(file)}
            onError={(msg) => setUploadError(msg)}
            align="start"
          >
            <button
              type="button"
              disabled={busy}
              className="w-20 h-20 rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-colors flex flex-col items-center justify-center gap-0.5 text-muted-foreground hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span className="text-[10px] font-medium">
                    {isUploading ? `${progress}%` : "…"}
                  </span>
                </>
              ) : (
                <>
                  <Upload size={16} />
                  <span className="text-[10px] font-medium leading-tight text-center px-1">
                    Add
                  </span>
                </>
              )}
            </button>
          </ImageSourcePicker>
        )}

        {images.length === 0 && !busy && (
          <div className="flex flex-col justify-center gap-0.5 text-muted-foreground text-sm min-h-20">
            <span className="inline-flex items-center gap-1.5">
              <ImageIcon size={14} />
              No images yet — up to {maxImages}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs">
              <Camera size={12} className="text-primary" />
              Upload from gallery or take a photo
            </span>
          </div>
        )}
      </div>

      {uploadError && <p className="text-sm text-red-500">{uploadError}</p>}
    </div>
  );
}
