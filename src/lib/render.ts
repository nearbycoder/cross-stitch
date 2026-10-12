// Canvas rendering of cross stitch charts, shared by the editor, PNG export and print.
import { contrastInk } from "./color";
import { getBit } from "./encoding";
import { SYMBOL_FONT } from "./symbols";
import { EMPTY, type Pattern } from "./types";

export type ViewMode = "symbol-color" | "color" | "symbol" | "stitch";

export interface RenderOptions {
  mode: ViewMode;
  cell: number; // px per stitch
  showGrid: boolean;
  fabricColor: string;
  highlight: number | null; // palette index to emphasize
  stitched?: Uint8Array | null;
  showStitched?: boolean;
  centerMarks?: boolean;
}

export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

const colorCanvasCache = new WeakMap<Uint16Array, { key: string; canvas: HTMLCanvasElement }>();

/** One pixel per stitch; drawn scaled-up with smoothing off for fast low-zoom rendering. */
function colorCanvas(p: Pattern, fabric: string, highlight: number | null): HTMLCanvasElement {
  const key = `${p.palette.map((c) => c.r + "," + c.g + "," + c.b).join("|")}|${fabric}|${highlight}`;
  const cached = colorCanvasCache.get(p.cells);
  if (cached && cached.key === key) return cached.canvas;
  const canvas = cached?.canvas ?? document.createElement("canvas");
  canvas.width = p.width;
  canvas.height = p.height;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(p.width, p.height);
  const fr = parseInt(fabric.slice(1, 3), 16);
  const fg = parseInt(fabric.slice(3, 5), 16);
  const fb = parseInt(fabric.slice(5, 7), 16);
  const d = img.data;
  for (let i = 0; i < p.cells.length; i++) {
    const c = p.cells[i];
    let r = fr;
    let g = fg;
    let b = fb;
    if (c !== EMPTY && c < p.palette.length) {
      const e = p.palette[c];
      r = e.r;
      g = e.g;
      b = e.b;
      if (highlight !== null && c !== highlight) {
        r = Math.round(r * 0.15 + 240 * 0.85);
        g = Math.round(g * 0.15 + 240 * 0.85);
        b = Math.round(b * 0.15 + 240 * 0.85);
      }
    }
    d[i * 4] = r;
    d[i * 4 + 1] = g;
    d[i * 4 + 2] = b;
    d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  colorCanvasCache.set(p.cells, { key, canvas });
  return canvas;
}

/** Invalidate cached raster after editing cells in place. */
export function invalidateRaster(p: Pattern) {
  colorCanvasCache.delete(p.cells);
}

function fadeHex(r: number, g: number, b: number, amt: number): string {
  return `rgb(${Math.round(r * (1 - amt) + 240 * amt)},${Math.round(g * (1 - amt) + 240 * amt)},${Math.round(b * (1 - amt) + 240 * amt)})`;
}

function shade(r: number, g: number, b: number, f: number): string {
  const k = (v: number) => Math.max(0, Math.min(255, Math.round(f > 0 ? v + (255 - v) * f : v * (1 + f))));
  return `rgb(${k(r)},${k(g)},${k(b)})`;
}

function drawFabric(ctx: CanvasRenderingContext2D, ox: number, oy: number, region: Region, cell: number, fabric: string) {
  ctx.fillStyle = fabric;
  ctx.fillRect(ox, oy, region.w * cell, region.h * cell);
  if (cell >= 8) {
    // Aida holes at cell corners.
    ctx.fillStyle = "rgba(0,0,0,0.13)";
    const r = Math.max(0.6, cell * 0.07);
    for (let y = 0; y <= region.h; y++) {
      for (let x = 0; x <= region.w; x++) {
        ctx.fillRect(ox + x * cell - r, oy + y * cell - r, r * 2, r * 2);
      }
    }
  }
}

function drawStitches(
  ctx: CanvasRenderingContext2D,
  p: Pattern,
  region: Region,
  ox: number,
  oy: number,
  cell: number,
  filter: (i: number) => boolean,
  highlight: number | null,
) {
  const byColor = new Map<number, Path2D>();
  const inset = cell * 0.14;
  for (let y = 0; y < region.h; y++) {
    const gy = region.y + y;
    for (let x = 0; x < region.w; x++) {
      const gx = region.x + x;
      const i = gy * p.width + gx;
      const c = p.cells[i];
      if (c === EMPTY || !filter(i)) continue;
      let path = byColor.get(c);
      if (!path) byColor.set(c, (path = new Path2D()));
      const px = ox + x * cell;
      const py = oy + y * cell;
      path.moveTo(px + inset, py + cell - inset);
      path.lineTo(px + cell - inset, py + inset);
      path.moveTo(px + inset, py + inset);
      path.lineTo(px + cell - inset, py + cell - inset);
    }
  }
  ctx.save();
  ctx.lineCap = "round";
  for (const [c, path] of byColor) {
    const e = p.palette[c];
    const faded = highlight !== null && c !== highlight;
    const fr = faded ? Math.round(e.r * 0.15 + 240 * 0.85) : e.r;
    const fg = faded ? Math.round(e.g * 0.15 + 240 * 0.85) : e.g;
    const fb = faded ? Math.round(e.b * 0.15 + 240 * 0.85) : e.b;
    ctx.lineWidth = Math.max(1, cell * 0.3);
    ctx.strokeStyle = shade(fr, fg, fb, -0.28);
    ctx.stroke(path);
    ctx.lineWidth = Math.max(0.8, cell * 0.2);
    ctx.strokeStyle = `rgb(${fr},${fg},${fb})`;
    ctx.stroke(path);
    if (cell >= 10) {
      ctx.lineWidth = Math.max(0.5, cell * 0.06);
      ctx.strokeStyle = shade(fr, fg, fb, 0.35);
      ctx.stroke(path);
    }
  }
  ctx.restore();
}

/**
 * Render a region of the pattern so that cell (region.x, region.y) lands at canvas (ox, oy).
 * Coordinates are in canvas pixels (caller applies DPR transform).
 */
export function renderRegion(
  ctx: CanvasRenderingContext2D,
  p: Pattern,
  region: Region,
  ox: number,
  oy: number,
  o: RenderOptions,
) {
  const { cell } = o;
  const W = region.w * cell;
  const H = region.h * cell;
  const showStitched = !!(o.showStitched && o.stitched);
  const isDone = (i: number) => showStitched && getBit(o.stitched!, i) === 1;

  if (o.mode === "stitch") {
    drawFabric(ctx, ox, oy, region, cell, o.fabricColor);
    drawStitches(ctx, p, region, ox, oy, cell, () => true, o.highlight);
  } else if (o.mode === "symbol") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(ox, oy, W, H);
    if (o.highlight !== null) {
      ctx.fillStyle = "#fde68a";
      for (let y = 0; y < region.h; y++)
        for (let x = 0; x < region.w; x++)
          if (p.cells[(region.y + y) * p.width + region.x + x] === o.highlight) ctx.fillRect(ox + x * cell, oy + y * cell, cell, cell);
    }
  } else {
    const raster = colorCanvas(p, o.fabricColor, o.highlight);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(raster, region.x, region.y, region.w, region.h, ox, oy, W, H);
    ctx.restore();
  }

  // Symbols
  if ((o.mode === "symbol-color" || o.mode === "symbol") && cell >= 7) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const multi = p.palette.some((e) => e.symbol.length > 1);
    ctx.font = `${Math.round(cell * (multi ? 0.55 : 0.72))}px ${SYMBOL_FONT}`;
    const inks = p.palette.map((e) => contrastInk(e.r, e.g, e.b));
    for (let y = 0; y < region.h; y++) {
      const gy = region.y + y;
      for (let x = 0; x < region.w; x++) {
        const i = gy * p.width + region.x + x;
        const c = p.cells[i];
        if (c === EMPTY || c >= p.palette.length) continue;
        if (isDone(i)) continue;
        const faded = o.highlight !== null && c !== o.highlight;
        if (o.mode === "symbol") ctx.fillStyle = faded ? "#c8c8cc" : "#111114";
        else {
          const e = p.palette[c];
          ctx.fillStyle = faded ? fadeHex(e.r, e.g, e.b, 0.6) : inks[c];
        }
        ctx.fillText(p.palette[c].symbol, ox + x * cell + cell / 2, oy + y * cell + cell / 2 + cell * 0.04);
      }
    }
    ctx.restore();
  }

  // Completed stitches drawn as real X stitches on fabric.
  if (showStitched && o.mode !== "stitch") {
    ctx.save();
    for (let y = 0; y < region.h; y++) {
      for (let x = 0; x < region.w; x++) {
        const i = (region.y + y) * p.width + region.x + x;
        if (p.cells[i] !== EMPTY && isDone(i)) {
          ctx.fillStyle = o.fabricColor;
          ctx.fillRect(ox + x * cell, oy + y * cell, cell, cell);
        }
      }
    }
    ctx.restore();
    drawStitches(ctx, p, region, ox, oy, cell, isDone, null);
  }

  if (o.showGrid && cell >= 4) drawGrid(ctx, p, region, ox, oy, cell, o.centerMarks ?? true);
}

function drawGrid(ctx: CanvasRenderingContext2D, p: Pattern, region: Region, ox: number, oy: number, cell: number, center: boolean) {
  const W = region.w * cell;
  const H = region.h * cell;
  ctx.save();
  // Minor lines
  ctx.beginPath();
  for (let x = 0; x <= region.w; x++) {
    if ((region.x + x) % 10 === 0) continue;
    const px = Math.round(ox + x * cell) + 0.5;
    ctx.moveTo(px, oy);
    ctx.lineTo(px, oy + H);
  }
  for (let y = 0; y <= region.h; y++) {
    if ((region.y + y) % 10 === 0) continue;
    const py = Math.round(oy + y * cell) + 0.5;
    ctx.moveTo(ox, py);
    ctx.lineTo(ox + W, py);
  }
  ctx.strokeStyle = cell >= 10 ? "rgba(40,40,50,0.28)" : "rgba(40,40,50,0.16)";
  ctx.lineWidth = 1;
  ctx.stroke();
  // Major lines every 10 stitches
  ctx.beginPath();
  for (let x = 0; x <= region.w; x++) {
    if ((region.x + x) % 10 !== 0) continue;
    const px = Math.round(ox + x * cell) + 0.5;
    ctx.moveTo(px, oy);
    ctx.lineTo(px, oy + H);
  }
  for (let y = 0; y <= region.h; y++) {
    if ((region.y + y) % 10 !== 0) continue;
    const py = Math.round(oy + y * cell) + 0.5;
    ctx.moveTo(ox, py);
    ctx.lineTo(ox + W, py);
  }
  ctx.strokeStyle = "rgba(20,20,28,0.75)";
  ctx.lineWidth = Math.max(1.5, cell * 0.1);
  ctx.stroke();
  // Center lines
  if (center) {
    const cx = Math.floor(p.width / 2);
    const cy = Math.floor(p.height / 2);
    ctx.strokeStyle = "rgba(220,38,38,0.85)";
    ctx.lineWidth = Math.max(1.5, cell * 0.12);
    ctx.beginPath();
    if (cx >= region.x && cx <= region.x + region.w) {
      const px = Math.round(ox + (cx - region.x) * cell) + 0.5;
      ctx.moveTo(px, oy);
      ctx.lineTo(px, oy + H);
    }
    if (cy >= region.y && cy <= region.y + region.h) {
      const py = Math.round(oy + (cy - region.y) * cell) + 0.5;
      ctx.moveTo(ox, py);
      ctx.lineTo(ox + W, py);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** Axis rulers with stitch numbers every 10. */
export function drawRulers(
  ctx: CanvasRenderingContext2D,
  p: Pattern,
  region: Region,
  ox: number,
  oy: number,
  cell: number,
  size: number,
  opts: {
    background?: string;
    color?: string;
    hover?: { x: number; y: number } | null;
    /** Pin the bands at fixed canvas coordinates (on-screen scrolling view). */
    bandX?: number;
    bandY?: number;
  } = {},
) {
  const W = region.w * cell;
  const H = region.h * cell;
  const bandY = opts.bandY ?? oy;
  const bandX = opts.bandX ?? ox;
  ctx.save();
  ctx.fillStyle = opts.background ?? "#f6f3ee";
  ctx.fillRect(ox, bandY - size, W, size);
  ctx.fillRect(bandX - size, oy, size, H);
  ctx.fillStyle = opts.color ?? "#57534e";
  ctx.font = `600 ${Math.min(12, Math.max(9, size * 0.45))}px Inter, system-ui, sans-serif`;
  ctx.textBaseline = "middle";
  const every = cell >= 6 ? 10 : cell >= 3 ? 20 : 50;
  const cx = Math.floor(p.width / 2);
  const cy = Math.floor(p.height / 2);
  ctx.textAlign = "center";
  for (let x = 0; x <= region.w; x++) {
    const gx = region.x + x;
    if (gx % every !== 0 || gx === 0) continue;
    const px = ox + x * cell;
    ctx.fillText(String(gx), px, bandY - size / 2);
    ctx.fillRect(px - 0.5, bandY - 4, 1, 4);
  }
  ctx.textAlign = "right";
  for (let y = 0; y <= region.h; y++) {
    const gy = region.y + y;
    if (gy % every !== 0 || gy === 0) continue;
    const py = oy + y * cell;
    ctx.fillText(String(gy), bandX - 6, py);
    ctx.fillRect(bandX - 4, py - 0.5, 4, 1);
  }
  // Center arrows
  ctx.fillStyle = "#dc2626";
  if (cx >= region.x && cx <= region.x + region.w) {
    const px = ox + (cx - region.x) * cell;
    ctx.beginPath();
    ctx.moveTo(px - 5, bandY - 9);
    ctx.lineTo(px + 5, bandY - 9);
    ctx.lineTo(px, bandY - 2);
    ctx.fill();
  }
  if (cy >= region.y && cy <= region.y + region.h) {
    const py = oy + (cy - region.y) * cell;
    ctx.beginPath();
    ctx.moveTo(bandX - 9, py - 5);
    ctx.lineTo(bandX - 9, py + 5);
    ctx.lineTo(bandX - 2, py);
    ctx.fill();
  }
  if (opts.hover) {
    ctx.fillStyle = "rgba(180,65,58,0.25)";
    const hx = opts.hover.x - region.x;
    const hy = opts.hover.y - region.y;
    if (hx >= 0 && hx < region.w) ctx.fillRect(ox + hx * cell, bandY - size, cell, size);
    if (hy >= 0 && hy < region.h) ctx.fillRect(bandX - size, oy + hy * cell, size, cell);
  }
  ctx.restore();
}

/** Render a whole pattern to a new canvas (for export/thumbnails). */
export function renderFull(p: Pattern, o: RenderOptions, rulers = 0): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = p.width * o.cell + rulers * 2;
  canvas.height = p.height * o.cell + rulers * 2;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const region = { x: 0, y: 0, w: p.width, h: p.height };
  renderRegion(ctx, p, region, rulers, rulers, o);
  if (rulers) drawRulers(ctx, p, region, rulers, rulers, o.cell, rulers, { background: "#ffffff" });
  return canvas;
}

export function thumbnail(p: Pattern, fabric: string, max = 360): string {
  const cell = Math.max(1, Math.floor(max / Math.max(p.width, p.height)));
  const mode: ViewMode = cell >= 4 ? "stitch" : "color";
  const c = renderFull(p, { mode, cell, showGrid: false, fabricColor: fabric, highlight: null });
  return c.toDataURL("image/jpeg", 0.85);
}
