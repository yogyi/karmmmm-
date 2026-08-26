/**
 * Normalize product photos for catalog cards:
 * - Trim near-white / transparent outer mats (phone screenshots, logo pads)
 * - Cover-crop to 4:3 (fills frame — no letterbox)
 * - Recompress to JPEG (phones / HEIC → image/jpeg)
 */

function isEmptyPixel(
  data: Uint8ClampedArray,
  idx: number,
  whiteThreshold: number,
  alphaThreshold: number,
): boolean {
  const r = data[idx]!;
  const g = data[idx + 1]!;
  const b = data[idx + 2]!;
  const a = data[idx + 3]!;
  if (a < alphaThreshold) return true;
  return r >= whiteThreshold && g >= whiteThreshold && b >= whiteThreshold;
}

/** Detect content bbox by stripping near-white / transparent borders. */
function detectContentBounds(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): { sx: number; sy: number; sw: number; sh: number } | null {
  const { data } = ctx.getImageData(0, 0, width, height);
  const whiteThreshold = 248;
  const alphaThreshold = 12;
  const rowEmpty = (y: number) => {
    const row = y * width * 4;
    for (let x = 0; x < width; x++) {
      if (!isEmptyPixel(data, row + x * 4, whiteThreshold, alphaThreshold)) return false;
    }
    return true;
  };
  const colEmpty = (x: number, top: number, bottom: number) => {
    for (let y = top; y <= bottom; y++) {
      if (!isEmptyPixel(data, (y * width + x) * 4, whiteThreshold, alphaThreshold)) return false;
    }
    return true;
  };

  let top = 0;
  while (top < height && rowEmpty(top)) top++;
  let bottom = height - 1;
  while (bottom > top && rowEmpty(bottom)) bottom--;
  let left = 0;
  while (left < width && colEmpty(left, top, bottom)) left++;
  let right = width - 1;
  while (right > left && colEmpty(right, top, bottom)) right--;

  const sw = right - left + 1;
  const sh = bottom - top + 1;
  // Ignore trim if almost nothing left or barely any margin was removed
  if (sw < 8 || sh < 8) return null;
  const trimmed = width * height - sw * sh;
  if (trimmed < width * height * 0.02) return null;

  return { sx: left, sy: top, sw, sh };
}

export async function normalizeProductImageFile(
  file: File,
  opts?: { maxEdge?: number; quality?: number; aspectRatio?: number },
): Promise<File> {
  const maxEdge = opts?.maxEdge ?? 1400;
  const quality = opts?.quality ?? 0.85;
  const aspectRatio = opts?.aspectRatio ?? 4 / 3;

  const bitmap = await createImageBitmap(file);
  try {
    // Draw full frame so we can scan for white/transparent mats
    const probe = document.createElement("canvas");
    probe.width = bitmap.width;
    probe.height = bitmap.height;
    const probeCtx = probe.getContext("2d", { willReadFrequently: true });
    if (!probeCtx) throw new Error("Could not process image");
    probeCtx.drawImage(bitmap, 0, 0);

    const trimmed = detectContentBounds(probeCtx, bitmap.width, bitmap.height);
    let sx = trimmed?.sx ?? 0;
    let sy = trimmed?.sy ?? 0;
    let sw = trimmed?.sw ?? bitmap.width;
    let sh = trimmed?.sh ?? bitmap.height;

    const srcRatio = sw / Math.max(1, sh);
    if (srcRatio > aspectRatio) {
      // Too wide — crop sides
      const nextSw = Math.max(1, Math.round(sh * aspectRatio));
      sx += Math.max(0, Math.round((sw - nextSw) / 2));
      sw = nextSw;
    } else if (srcRatio < aspectRatio) {
      // Too tall — crop top/bottom
      const nextSh = Math.max(1, Math.round(sw / aspectRatio));
      sy += Math.max(0, Math.round((sh - nextSh) / 2));
      sh = nextSh;
    }

    const scale = Math.min(1, maxEdge / Math.max(sw, sh));
    const w = Math.max(1, Math.round(sw * scale));
    const h = Math.max(1, Math.round(sh * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not process image");

    // Solid fill so transparent PNGs never show card white as a “margin”
    ctx.fillStyle = "#e8edf3";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, w, h);

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
