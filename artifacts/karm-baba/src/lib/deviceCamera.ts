/**
 * Device camera helpers for professional image capture.
 * Browser stores camera permission — once granted, later visits won't re-prompt.
 */

export type CameraPermissionState = "granted" | "denied" | "prompt" | "unsupported";

export function prefersNativeCameraCapture(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isMobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const coarse =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;
  return isMobileUa || coarse;
}

export async function queryCameraPermission(): Promise<CameraPermissionState> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return "unsupported";
  }
  try {
    const perms = navigator.permissions;
    if (perms?.query) {
      const status = await perms.query({ name: "camera" as PermissionName });
      if (status.state === "granted" || status.state === "denied" || status.state === "prompt") {
        return status.state;
      }
    }
  } catch {
    // Safari / Firefox may not support camera permission query.
  }
  return "prompt";
}

export async function hasVideoInputDevice(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
    return false;
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.some((d) => d.kind === "videoinput");
  } catch {
    return false;
  }
}

export async function openCameraStream(
  facingMode: "user" | "environment" = "user",
): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("CAMERA_UNSUPPORTED");
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });
  } catch (err) {
    const name = err instanceof DOMException ? err.name : "";
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      throw new Error("CAMERA_NOT_FOUND");
    }
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      throw new Error("CAMERA_DENIED");
    }
    if (name === "NotReadableError" || name === "TrackStartError") {
      throw new Error("CAMERA_IN_USE");
    }
    throw err instanceof Error ? err : new Error("CAMERA_FAILED");
  }
}

export function stopMediaStream(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((t) => t.stop());
}

export function captureVideoFrame(
  video: HTMLVideoElement,
  quality = 0.9,
): Promise<File> {
  const w = video.videoWidth || 1280;
  const h = video.videoHeight || 720;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Could not capture photo"));
  ctx.drawImage(video, 0, 0, w, h);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not capture photo"));
          return;
        }
        resolve(
          new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" }),
        );
      },
      "image/jpeg",
      quality,
    );
  });
}

export function cameraErrorMessage(code: string): string {
  switch (code) {
    case "CAMERA_NOT_FOUND":
      return "Camera not detected on this device.";
    case "CAMERA_DENIED":
      return "Camera permission is blocked. Allow camera access in your browser settings, then try again.";
    case "CAMERA_IN_USE":
      return "Camera is in use by another app. Close it and try again.";
    case "CAMERA_UNSUPPORTED":
      return "This browser cannot open the camera. Upload a photo instead.";
    default:
      return "Could not open the camera. Try uploading a photo instead.";
  }
}
