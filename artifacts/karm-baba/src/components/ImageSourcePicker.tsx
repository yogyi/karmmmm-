import { useEffect, useRef, useState, type ReactNode } from "react";
import { Camera, ImagePlus, Loader2, SwitchCamera, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  cameraErrorMessage,
  captureVideoFrame,
  openCameraStream,
  prefersNativeCameraCapture,
  queryCameraPermission,
  stopMediaStream,
} from "@/lib/deviceCamera";

type Props = {
  children: ReactNode;
  disabled?: boolean;
  accept?: string;
  /** Prefer rear camera (products / covers) */
  preferEnvironment?: boolean;
  onFile: (file: File) => void | Promise<void>;
  onError?: (message: string) => void;
  align?: "start" | "center" | "end";
};

const CAPTURE_ATTR = "data-kb-camera-open";

/**
 * Same flow as shareable profile card:
 * Upload photo | Take photo → permission + live camera → Capture → Use photo → parent uploads.
 */
export function ImageSourcePicker({
  children,
  disabled,
  accept = "image/jpeg,image/png,image/webp,image/gif",
  preferEnvironment = false,
  onFile,
  onError,
  align = "end",
}: Props) {
  const uploadRef = useRef<HTMLInputElement>(null);
  const nativeCaptureRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onFileRef = useRef(onFile);
  const onErrorRef = useRef(onError);
  onFileRef.current = onFile;
  onErrorRef.current = onError;

  const [menuOpen, setMenuOpen] = useState(false);
  const [camOpen, setCamOpen] = useState(false);
  const [camBusy, setCamBusy] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">(
    preferEnvironment ? "environment" : "user",
  );
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);

  useEffect(() => {
    return () => {
      stopMediaStream(streamRef.current);
      document.body.removeAttribute(CAPTURE_ATTR);
    };
  }, []);

  useEffect(() => {
    if (camOpen) document.body.setAttribute(CAPTURE_ATTR, "1");
    else document.body.removeAttribute(CAPTURE_ATTR);
  }, [camOpen]);

  useEffect(() => {
    if (!camOpen) {
      stopMediaStream(streamRef.current);
      streamRef.current = null;
      return;
    }
    let cancelled = false;
    void (async () => {
      setCamBusy(true);
      setCamError(null);
      setSnapshot(null);
      setCapturedFile(null);
      try {
        // Always request getUserMedia here — this is what triggers the permission prompt
        // (same as shareable profile card).
        const stream = await openCameraStream(facing);
        if (cancelled) {
          stopMediaStream(stream);
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
      } catch (err) {
        const code = err instanceof Error ? err.message : "CAMERA_FAILED";
        // On phones, if in-app camera fails as unsupported, fall back to system camera.
        if (
          (code === "CAMERA_UNSUPPORTED" || code === "CAMERA_FAILED") &&
          prefersNativeCameraCapture()
        ) {
          setCamOpen(false);
          window.setTimeout(() => nativeCaptureRef.current?.click(), 50);
          return;
        }
        const msg = cameraErrorMessage(code);
        setCamError(msg);
        onErrorRef.current?.(msg);
      } finally {
        if (!cancelled) setCamBusy(false);
      }
    })();
    return () => {
      cancelled = true;
      stopMediaStream(streamRef.current);
      streamRef.current = null;
    };
  }, [camOpen, facing]);

  function emitFileFromInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    void (async () => {
      try {
        await onFileRef.current(file);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Could not upload photo";
        onErrorRef.current?.(msg);
      }
    })();
  }

  function startUploadFromDevice() {
    setMenuOpen(false);
    // Keep in the same tick as much as possible for user-gesture / file picker.
    requestAnimationFrame(() => uploadRef.current?.click());
  }

  async function startTakePhoto() {
    setMenuOpen(false);
    const permission = await queryCameraPermission();
    if (permission === "unsupported" && prefersNativeCameraCapture()) {
      requestAnimationFrame(() => nativeCaptureRef.current?.click());
      return;
    }
    if (permission === "unsupported") {
      const msg = cameraErrorMessage("CAMERA_UNSUPPORTED");
      onErrorRef.current?.(msg);
      return;
    }
    // Opens dialog → getUserMedia asks permission (browser remembers after Allow).
    setCamOpen(true);
  }

  async function takeSnapshot() {
    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      const msg = "Camera is still starting. Wait a moment, then tap Capture.";
      setCamError(msg);
      onErrorRef.current?.(msg);
      return;
    }
    try {
      setCamBusy(true);
      const file = await captureVideoFrame(video);
      const url = URL.createObjectURL(file);
      setSnapshot(url);
      setCapturedFile(file);
      video.pause();
    } catch {
      const msg = "Could not capture photo. Try again.";
      setCamError(msg);
      onErrorRef.current?.(msg);
    } finally {
      setCamBusy(false);
    }
  }

  async function retake() {
    if (snapshot) URL.revokeObjectURL(snapshot);
    setSnapshot(null);
    setCapturedFile(null);
    setCamError(null);
    setCamBusy(true);
    try {
      const video = videoRef.current;
      let stream = streamRef.current;
      // Stream may have stalled while reviewing the snapshot — reopen if needed.
      const live = stream?.getVideoTracks().some((t) => t.readyState === "live");
      if (!live) {
        stopMediaStream(stream);
        stream = await openCameraStream(facing);
        streamRef.current = stream;
      }
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
    } catch (err) {
      const code = err instanceof Error ? err.message : "CAMERA_FAILED";
      const msg = cameraErrorMessage(code);
      setCamError(msg);
      onErrorRef.current?.(msg);
    } finally {
      setCamBusy(false);
    }
  }

  async function confirmCapture() {
    if (!capturedFile) return;
    const file = capturedFile;
    const snap = snapshot;
    setCamOpen(false);
    setSnapshot(null);
    setCapturedFile(null);
    if (snap) URL.revokeObjectURL(snap);
    try {
      await onFileRef.current(file);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not upload photo";
      onErrorRef.current?.(msg);
    }
  }

  function closeCamera() {
    setCamOpen(false);
    if (snapshot) URL.revokeObjectURL(snapshot);
    setSnapshot(null);
    setCapturedFile(null);
    setCamError(null);
  }

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild disabled={disabled}>
          {children}
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} className="w-52 !z-[400]">
          <DropdownMenuItem
            className="gap-2 cursor-pointer"
            onSelect={(e) => {
              e.preventDefault();
              startUploadFromDevice();
            }}
          >
            <ImagePlus size={16} className="text-primary" />
            Upload photo
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2 cursor-pointer"
            onSelect={(e) => {
              e.preventDefault();
              void startTakePhoto();
            }}
          >
            <Camera size={16} className="text-primary" />
            Take photo
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer text-muted-foreground"
            onSelect={() => setMenuOpen(false)}
          >
            Cancel
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <input
        ref={uploadRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={emitFileFromInput}
      />
      <input
        ref={nativeCaptureRef}
        type="file"
        accept="image/*"
        capture={preferEnvironment ? "environment" : "user"}
        className="hidden"
        onChange={emitFileFromInput}
      />

      <Dialog
        open={camOpen}
        onOpenChange={(open) => {
          if (!open) closeCamera();
        }}
      >
        <DialogContent
          className="sm:max-w-lg p-0 overflow-hidden gap-0 !z-[450]"
          overlayClassName="!z-[450]"
          // Above app modals (z-300). Don't dismiss mid-capture.
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader className="px-5 pt-5 pb-3">
            <DialogTitle className="font-heading">Take a photo</DialogTitle>
            <DialogDescription>
              {camError
                ? camError
                : "Allow camera access when your browser asks. After you allow once, it won’t ask again on this device."}
            </DialogDescription>
          </DialogHeader>

          <div className="relative bg-secondary aspect-[4/3] mx-5 rounded-xl overflow-hidden">
            {/* Keep <video> mounted so Retake can resume the same stream. */}
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className={`absolute inset-0 w-full h-full object-cover ${
                facing === "user" ? "scale-x-[-1]" : ""
              } ${snapshot ? "opacity-0" : "opacity-100"}`}
            />
            {snapshot ? (
              <img
                src={snapshot}
                alt="Captured"
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : null}
            {camBusy && !snapshot ? (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <Loader2 className="animate-spin text-white" size={28} />
              </div>
            ) : null}
            {camError && !snapshot ? (
              <div className="absolute inset-0 bg-secondary flex flex-col items-center justify-center gap-2 px-6 text-center">
                <Camera className="text-white/50" size={32} />
                <p className="text-sm text-white/90 font-medium">{camError}</p>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
            <button
              type="button"
              onClick={closeCamera}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground px-3 py-2 rounded-xl"
            >
              <X size={14} /> Cancel
            </button>
            <div className="flex items-center gap-2">
              {!camError && !snapshot ? (
                <button
                  type="button"
                  disabled={camBusy}
                  onClick={() =>
                    setFacing((f) => (f === "user" ? "environment" : "user"))
                  }
                  className="inline-flex items-center gap-1.5 text-sm font-semibold border border-border px-3 py-2 rounded-xl hover:bg-muted disabled:opacity-50"
                  title="Switch camera"
                >
                  <SwitchCamera size={14} /> Flip
                </button>
              ) : null}
              {snapshot ? (
                <>
                  <button
                    type="button"
                    disabled={camBusy}
                    onClick={() => void retake()}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold border border-border px-3 py-2 rounded-xl hover:bg-muted disabled:opacity-50"
                  >
                    {camBusy ? <Loader2 size={14} className="animate-spin" /> : null}
                    Retake
                  </button>
                  <button
                    type="button"
                    disabled={camBusy}
                    onClick={() => void confirmCapture()}
                    className="inline-flex items-center gap-1.5 text-sm font-bold bg-primary text-white px-4 py-2 rounded-xl hover:bg-primary/90 disabled:opacity-50"
                  >
                    Use photo
                  </button>
                </>
              ) : !camError ? (
                <button
                  type="button"
                  disabled={camBusy}
                  onClick={() => void takeSnapshot()}
                  className="inline-flex items-center gap-1.5 text-sm font-bold bg-primary text-white px-4 py-2 rounded-xl hover:bg-primary/90 disabled:opacity-50"
                >
                  <Camera size={14} /> Capture
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    closeCamera();
                    requestAnimationFrame(() => uploadRef.current?.click());
                  }}
                  className="inline-flex items-center gap-1.5 text-sm font-bold bg-primary text-white px-4 py-2 rounded-xl hover:bg-primary/90"
                >
                  <ImagePlus size={14} /> Upload instead
                </button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
