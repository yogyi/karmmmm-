import { useRef, useState } from "react";
import { useUpload } from "@workspace/object-storage-web";
import { Upload, X, ImageIcon, Loader2 } from "lucide-react";

interface ImageUploaderProps {
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
}

export function ImageUploader({ images, onChange, maxImages = 5 }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { uploadFile, isUploading, progress } = useUpload({
    onSuccess: (response) => {
      const servingUrl = `/api/storage${response.objectPath}`;
      onChange([...images, servingUrl]);
      setUploadError(null);
    },
    onError: (err) => {
      setUploadError(err.message);
    },
  });

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadError("Only image files are allowed");
      return;
    }
    setUploadError(null);
    await uploadFile(file);
    if (inputRef.current) inputRef.current.value = "";
  }

  function removeImage(idx: number) {
    onChange(images.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {images.map((url, i) => (
          <div key={i} className="relative group w-20 h-20 rounded-lg border border-border overflow-hidden bg-muted">
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
            onClick={() => !isUploading && inputRef.current?.click()}
            disabled={isUploading}
            className="w-20 h-20 rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-colors flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span className="text-xs">{progress}%</span>
              </>
            ) : (
              <>
                <Upload size={18} />
                <span className="text-xs">Upload</span>
              </>
            )}
          </button>
        )}

        {images.length === 0 && !isUploading && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <ImageIcon size={14} />
            <span>No images yet — upload up to {maxImages}</span>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFiles}
      />

      {uploadError && (
        <p className="text-sm text-red-500">{uploadError}</p>
      )}
    </div>
  );
}
