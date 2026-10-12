import type { Crop } from "./types";

export interface LoadedImage {
  dataUrl: string;
  width: number;
  height: number;
}

const MAX_SOURCE = 1600;

export async function readImageFile(file: Blob): Promise<LoadedImage> {
  if (file.type && !file.type.startsWith("image/")) throw new Error("That file isn't an image.");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Couldn't read that image. Try a PNG, JPEG, WebP or GIF.");
  }
  const scale = Math.min(1, MAX_SOURCE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const hasAlpha = detectAlpha(ctx.getImageData(0, 0, w, h).data);
  const dataUrl = hasAlpha ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.92);
  return { dataUrl, width: w, height: h };
}

function detectAlpha(data: Uint8ClampedArray): boolean {
  for (let i = 3; i < data.length; i += 16) if (data[i] < 250) return true;
  return false;
}

const imageCache = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(src: string): Promise<HTMLImageElement> {
  let p = imageCache.get(src);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = src;
    });
    imageCache.set(src, p);
    if (imageCache.size > 12) imageCache.delete(imageCache.keys().next().value!);
  }
  return p;
}

/** Crop and resample the source image to exactly w×h pixels using progressive halving. */
export function samplePixels(img: HTMLImageElement, crop: Crop, w: number, h: number): ImageData {
  let sx = crop.x * img.naturalWidth;
  let sy = crop.y * img.naturalHeight;
  let sw = Math.max(1, crop.w * img.naturalWidth);
  let sh = Math.max(1, crop.h * img.naturalHeight);

  let src: CanvasImageSource = img;
  // Halve repeatedly so the final resample never skips source pixels (box-filter-like quality).
  while (sw / 2 >= w && sh / 2 >= h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(sw / 2));
    c.height = Math.max(1, Math.round(sh / 2));
    const cx = c.getContext("2d")!;
    cx.imageSmoothingQuality = "high";
    cx.drawImage(src, sx, sy, sw, sh, 0, 0, c.width, c.height);
    src = c;
    sx = 0;
    sy = 0;
    sw = c.width;
    sh = c.height;
  }
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "pattern";
}
