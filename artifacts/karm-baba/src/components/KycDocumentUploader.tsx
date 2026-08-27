import { useRef, useState } from "react";
import { useAuth as useClerkAuth } from "@clerk/react";
import { useUpload } from "@workspace/object-storage-web";
import { Check, FileText, IdCard, Loader2, Upload, X } from "lucide-react";
import { mediaUrlFromUpload } from "@/lib/mediaUrl";
import { cn } from "@/lib/utils";

type KycDocumentUploaderProps = {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  /** Shown under the uploaded file — use to stress upload ≠ verification. */
  uploadedNote?: string;
  /**
   * When set, controls success styling:
   * - true = API-verified (green)
   * - false = uploaded only / rejected (amber)
   * - undefined = neutral upload (default)
   */
  apiVerified?: boolean | null;
};

const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

function documentShortName(label: string): string {
  return label.replace(/\s*\*+\s*$/, "").trim() || "Document";
}

export function KycDocumentUploader({
  value,
  onChange,
  label = "Aadhaar card *",
  hint = "Upload front and back in one PDF, or a clear photo. Stored securely — only you and Karm Baba admins can access it.",
  error,
  disabled,
  uploadedNote,
  apiVerified,
}: KycDocumentUploaderProps) {
  const docName = documentShortName(label);
  const inputRef = useRef<HTMLInputElement>(null);
  const { getToken } = useClerkAuth();
  const [localError, setLocalError] = useState<string | null>(null);
  const { uploadFile, isUploading, progress } = useUpload({
    getToken,
    finalizeVisibility: "private",
  });

  const isPdf = value.toLowerCase().includes(".pdf") || value.includes("pdf");
  const showError = error || localError;
  const DocIcon = isPdf ? FileText : IdCard;
  const verified = apiVerified === true;
  const pendingVerify = apiVerified === false;

  async function handleFile(file: File) {
    setLocalError(null);
    const allowed =
      file.type === "application/pdf" ||
      file.type.startsWith("image/") ||
      /\.(jpe?g|png|webp|pdf)$/i.test(file.name);
    if (!allowed) {
      setLocalError("Upload a JPEG, PNG, WebP, or PDF file");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setLocalError("File must be 8MB or smaller");
      return;
    }
    try {
      const uploaded = await uploadFile(file);
      onChange(mediaUrlFromUpload(uploaded));
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Upload failed");
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-semibold text-[#1a3a4a]">{label}</label>
        {showError ? (
          <p className="mt-1 text-xs font-medium text-red-600">{showError}</p>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{hint}</p>
        )}
      </div>

      {value ? (
        <div
          className={cn(
            "flex items-center gap-3 rounded-xl border p-4",
            verified
              ? "border-emerald-200/80 bg-emerald-50/50"
              : pendingVerify
                ? "border-amber-200/80 bg-amber-50/40"
                : "border-border bg-white/80",
          )}
        >
          <div
            className={cn(
              "w-12 h-12 rounded-xl border flex items-center justify-center shrink-0",
              verified
                ? "bg-white border-emerald-100"
                : pendingVerify
                  ? "bg-white border-amber-100"
                  : "bg-muted/40 border-border",
            )}
          >
            <DocIcon
              size={22}
              className={
                verified
                  ? "text-emerald-700"
                  : pendingVerify
                    ? "text-amber-800"
                    : "text-foreground/70"
              }
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#1a3a4a] flex items-center gap-1.5">
              <Check
                size={14}
                className={cn(
                  "shrink-0",
                  verified ? "text-emerald-600" : "text-muted-foreground",
                )}
              />
              {verified
                ? `${docName} verified via API`
                : isPdf
                  ? `${docName} (PDF) uploaded — not verified`
                  : `${docName} uploaded — not verified`}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {verified
                ? "Official GST certificate checked by OCR API"
                : uploadedNote || "Saved only — API verification still required"}
            </p>
          </div>
          {!disabled ? (
            <button
              type="button"
              onClick={() => onChange("")}
              className="p-2 rounded-lg hover:bg-white/80 text-muted-foreground shrink-0 transition-colors"
              aria-label="Remove document"
            >
              <X size={16} />
            </button>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || isUploading}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-10 transition-all min-h-[8.5rem]",
            showError
              ? "border-red-300 bg-red-50/40"
              : "border-[#1a2744]/15 bg-[#fafbfc] hover:border-primary/35 hover:bg-primary/[0.02]",
            "disabled:opacity-60",
          )}
        >
          {isUploading ? (
            <>
              <Loader2 size={24} className="animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Uploading… {progress}%</span>
            </>
          ) : (
            <>
              <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center">
                <Upload size={20} className="text-primary" />
              </div>
              <span className="text-sm font-semibold text-[#1a3a4a]">Upload {docName.toLowerCase()}</span>
              <span className="text-xs text-muted-foreground">JPEG, PNG, WebP, or PDF · max 8MB</span>
            </>
          )}
        </button>
      )}

      {value && !disabled ? (
        <button
          type="button"
          disabled={isUploading}
          onClick={() => inputRef.current?.click()}
          className="text-sm font-semibold text-primary hover:text-primary/80 disabled:opacity-50 transition-colors"
        >
          Replace file
        </button>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        disabled={disabled || isUploading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handleFile(file);
        }}
      />
    </div>
  );
}
