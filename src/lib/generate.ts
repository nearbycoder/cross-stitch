// Image -> cross stitch pattern conversion. Runs inside a Web Worker.
import { DMC, type Floss } from "./dmc";
import { deltaE2000, deltaE76, rgbToLab, type Lab } from "./color";
import { SYMBOLS } from "./symbols";
import { EMPTY, type PaletteEntry, type PatternSettings } from "./types";

export interface GenerateInput {
  pixels: Uint8ClampedArray; // RGBA, width*height*4, already resized/cropped
  width: number;
  height: number;
  settings: PatternSettings;
  stash: string[];
}

export interface GenerateOutput {
  width: number;
  height: number;
  palette: PaletteEntry[];
  cells: Uint16Array;
}

type Progress = (stage: string, pct: number) => void;

interface Candidate {
  floss: Floss;
  lab: Lab;
}

const ALL_CANDIDATES: Candidate[] = DMC.map((f) => ({ floss: f, lab: rgbToLab(f.r, f.g, f.b) }));

function distFn(metric: PatternSettings["metric"]) {
  return metric === "ciede2000" ? deltaE2000 : deltaE76;
}

function nearestCandidate(lab: Lab, cands: Candidate[], dist: (a: Lab, b: Lab) => number): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < cands.length; i++) {
    const d = dist(lab, cands[i].lab);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Brightness / contrast / saturation / sharpen applied in-place. */
export function adjustPixels(px: Uint8ClampedArray, w: number, h: number, s: PatternSettings) {
  const b = s.brightness * 1.28;
  const c = (s.contrast + 100) / 100;
  const cf = c * c;
  const sat = (s.saturation + 100) / 100;
  for (let i = 0; i < px.length; i += 4) {
    let r = px[i];
    let g = px[i + 1];
    let bl = px[i + 2];
    r = (r - 128) * cf + 128 + b;
    g = (g - 128) * cf + 128 + b;
    bl = (bl - 128) * cf + 128 + b;
    const gray = 0.299 * r + 0.587 * g + 0.114 * bl;
    r = gray + (r - gray) * sat;
    g = gray + (g - gray) * sat;
    bl = gray + (bl - gray) * sat;
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = bl;
  }
  if (s.sharpen > 0) {
    const amt = s.sharpen / 100;
    const src = new Uint8ClampedArray(px);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = (y * w + x) * 4;
        for (let ch = 0; ch < 3; ch++) {
          const center = src[i + ch];
          const sum =
            src[i - 4 + ch] + src[i + 4 + ch] + src[i - w * 4 + ch] + src[i + w * 4 + ch];
          px[i + ch] = center + amt * (4 * center - sum);
        }
      }
    }
  }
}

/** k-means++ in Lab space over a pixel sample, returning cluster centroids. */
function kmeans(labs: Float32Array, n: number, k: number, iterations = 16): Lab[] {
  const sampleMax = 24000;
  const step = Math.max(1, Math.floor(n / sampleMax));
  const idx: number[] = [];
  for (let i = 0; i < n; i += step) idx.push(i);
  const m = idx.length;
  if (m === 0) return [];
  k = Math.min(k, m);

  // Seed with k-means++.
  const centers: Lab[] = [];
  let seed = 1337;
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const first = idx[Math.floor(rand() * m)];
  centers.push([labs[first * 3], labs[first * 3 + 1], labs[first * 3 + 2]]);
  const d2 = new Float64Array(m).fill(Infinity);
  while (centers.length < k) {
    const c = centers[centers.length - 1];
    let total = 0;
    for (let j = 0; j < m; j++) {
      const p = idx[j] * 3;
      const dl = labs[p] - c[0];
      const da = labs[p + 1] - c[1];
      const db = labs[p + 2] - c[2];
      const d = dl * dl + da * da + db * db;
      if (d < d2[j]) d2[j] = d;
      total += d2[j];
    }
    if (total === 0) break;
    let r = rand() * total;
    let pick = m - 1;
    for (let j = 0; j < m; j++) {
      r -= d2[j];
      if (r <= 0) {
        pick = j;
        break;
      }
    }
    const p = idx[pick] * 3;
    centers.push([labs[p], labs[p + 1], labs[p + 2]]);
  }

  const assign = new Int32Array(m);
  for (let it = 0; it < iterations; it++) {
    let moved = 0;
    for (let j = 0; j < m; j++) {
      const p = idx[j] * 3;
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < centers.length; c++) {
        const ce = centers[c];
        const dl = labs[p] - ce[0];
        const da = labs[p + 1] - ce[1];
        const db = labs[p + 2] - ce[2];
        const d = dl * dl + da * da + db * db;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      if (assign[j] !== best) moved++;
      assign[j] = best;
    }
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (let j = 0; j < m; j++) {
      const p = idx[j] * 3;
      const s = sums[assign[j]];
      s[0] += labs[p];
      s[1] += labs[p + 1];
      s[2] += labs[p + 2];
      s[3]++;
    }
    for (let c = 0; c < centers.length; c++) {
      const s = sums[c];
      if (s[3] > 0) centers[c] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]];
    }
    if (it > 2 && moved < m * 0.002) break;
  }
  return centers;
}

export function generatePattern(input: GenerateInput, progress: Progress): GenerateOutput {
  const { width: w, height: h, settings: s } = input;
  const px = new Uint8ClampedArray(input.pixels);
  const n = w * h;
  progress("Adjusting image", 0.05);
  adjustPixels(px, w, h, s);

  // Lab conversion with a small cache since many pixels repeat.
  progress("Analyzing colors", 0.12);
  const labs = new Float32Array(n * 3);
  const opaque = new Uint8Array(n);
  const labCache = new Map<number, Lab>();
  const opaqueIdx: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = px[i * 4 + 3];
    if (s.transparentAsEmpty && a < 128) continue;
    opaque[i] = 1;
    // Composite semi-transparent pixels over white.
    let r = px[i * 4];
    let g = px[i * 4 + 1];
    let b = px[i * 4 + 2];
    if (a < 255) {
      const t = a / 255;
      r = Math.round(r * t + 255 * (1 - t));
      g = Math.round(g * t + 255 * (1 - t));
      b = Math.round(b * t + 255 * (1 - t));
      px[i * 4] = r;
      px[i * 4 + 1] = g;
      px[i * 4 + 2] = b;
    }
    const key = (r << 16) | (g << 8) | b;
    let lab = labCache.get(key);
    if (!lab) {
      lab = rgbToLab(r, g, b);
      labCache.set(key, lab);
    }
    labs[i * 3] = lab[0];
    labs[i * 3 + 1] = lab[1];
    labs[i * 3 + 2] = lab[2];
    opaqueIdx.push(i);
  }

  const dist = distFn(s.metric);
  let candidates = ALL_CANDIDATES;
  if (s.stashOnly && input.stash.length > 0) {
    const owned = new Set(input.stash);
    const filtered = ALL_CANDIDATES.filter((c) => owned.has(c.floss.code));
    if (filtered.length > 0) candidates = filtered;
  }

  // Compact Lab array of opaque pixels for clustering.
  const m = opaqueIdx.length;
  const compact = new Float32Array(m * 3);
  for (let j = 0; j < m; j++) {
    const p = opaqueIdx[j] * 3;
    compact[j * 3] = labs[p];
    compact[j * 3 + 1] = labs[p + 1];
    compact[j * 3 + 2] = labs[p + 2];
  }

  progress("Clustering colors", 0.2);
  const maxColors = Math.max(2, Math.min(s.maxColors, candidates.length));
  // Over-cluster a little: several clusters often snap to the same floss.
  const centers = kmeans(compact, m, Math.min(Math.round(maxColors * 1.6) + 2, 256));

  progress("Matching DMC floss", 0.45);
  // Map each centroid to floss; weight floss by number of pixels it absorbs.
  const weight = new Map<number, number>();
  const centerFloss = centers.map((c) => nearestCandidate(c, candidates, dist));
  {
    // Population per centroid from a sample.
    const counts = new Array(centers.length).fill(0);
    const step = Math.max(1, Math.floor(m / 20000));
    for (let j = 0; j < m; j += step) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < centers.length; c++) {
        const ce = centers[c];
        const dl = compact[j * 3] - ce[0];
        const da = compact[j * 3 + 1] - ce[1];
        const db = compact[j * 3 + 2] - ce[2];
        const d = dl * dl + da * da + db * db;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      counts[best]++;
    }
    centers.forEach((_, c) => {
      const f = centerFloss[c];
      weight.set(f, (weight.get(f) ?? 0) + counts[c]);
    });
  }

  // Reduce to maxColors by merging the least-populated floss into its nearest neighbour.
  const pool = [...weight.entries()].map(([f, wgt]) => ({ f, wgt }));
  while (pool.length > maxColors) {
    pool.sort((a, b) => b.wgt - a.wgt);
    const victim = pool.pop()!;
    let target = 0;
    let bestD = Infinity;
    for (let j = 0; j < pool.length; j++) {
      const d = dist(candidates[victim.f].lab, candidates[pool[j].f].lab);
      if (d < bestD) {
        bestD = d;
        target = j;
      }
    }
    pool[target].wgt += victim.wgt;
  }
  let chosen = pool.sort((a, b) => b.wgt - a.wgt).map((p) => p.f);

  // Refinement: reassign pixels and re-snap each palette entry to its cluster mean.
  for (let pass = 0; pass < 3; pass++) {
    progress("Refining palette", 0.5 + pass * 0.06);
    const pal = chosen.map((ci) => candidates[ci]);
    const sums = pal.map(() => [0, 0, 0, 0]);
    const step = Math.max(1, Math.floor(m / 30000));
    for (let j = 0; j < m; j += step) {
      const lab: Lab = [compact[j * 3], compact[j * 3 + 1], compact[j * 3 + 2]];
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < pal.length; c++) {
        const d = deltaE76(lab, pal[c].lab);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      const sm = sums[best];
      sm[0] += lab[0];
      sm[1] += lab[1];
      sm[2] += lab[2];
      sm[3]++;
    }
    const next = new Set<number>();
    const ordered: number[] = [];
    sums.forEach((sm, c) => {
      const ci = sm[3] > 0 ? nearestCandidate([sm[0] / sm[3], sm[1] / sm[3], sm[2] / sm[3]], candidates, dist) : chosen[c];
      if (sm[3] > 0 && !next.has(ci)) {
        next.add(ci);
        ordered.push(ci);
      }
    });
    if (ordered.length === 0) break;
    chosen = ordered;
  }

  const pal = chosen.map((ci) => candidates[ci]);
  const cells = new Uint16Array(n).fill(EMPTY);

  progress("Mapping stitches", 0.7);
  const nearestPal = (lab: Lab) => {
    let best = 0;
    let bestD = Infinity;
    for (let c = 0; c < pal.length; c++) {
      const d = dist(lab, pal[c].lab);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  };

  if (s.dither === "none" || s.ditherStrength <= 0) {
    const cache = new Map<string, number>();
    for (let i = 0; i < n; i++) {
      if (!opaque[i]) continue;
      const key = `${labs[i * 3].toFixed(1)},${labs[i * 3 + 1].toFixed(1)},${labs[i * 3 + 2].toFixed(1)}`;
      let c = cache.get(key);
      if (c === undefined) {
        c = nearestPal([labs[i * 3], labs[i * 3 + 1], labs[i * 3 + 2]]);
        cache.set(key, c);
      }
      cells[i] = c;
    }
  } else if (s.dither === "ordered") {
    const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    const amp = 28 * s.ditherStrength;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!opaque[i]) continue;
        const t = (bayer[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * amp;
        const r = px[i * 4] + t;
        const g = px[i * 4 + 1] + t;
        const b = px[i * 4 + 2] + t;
        cells[i] = nearestPal(rgbToLab(clamp(r), clamp(g), clamp(b)));
      }
    }
  } else {
    // Error diffusion in RGB space, strength-scaled.
    const buf = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      buf[i * 3] = px[i * 4];
      buf[i * 3 + 1] = px[i * 4 + 1];
      buf[i * 3 + 2] = px[i * 4 + 2];
    }
    const kernel: [number, number, number][] =
      s.dither === "atkinson"
        ? [
            [1, 0, 1 / 8],
            [2, 0, 1 / 8],
            [-1, 1, 1 / 8],
            [0, 1, 1 / 8],
            [1, 1, 1 / 8],
            [0, 2, 1 / 8],
          ]
        : [
            [1, 0, 7 / 16],
            [-1, 1, 3 / 16],
            [0, 1, 5 / 16],
            [1, 1, 1 / 16],
          ];
    const k = s.ditherStrength;
    for (let y = 0; y < h; y++) {
      if (y % 16 === 0) progress("Dithering", 0.7 + (0.15 * y) / h);
      // Serpentine scanning reduces directional artifacts.
      const ltr = y % 2 === 0;
      for (let xi = 0; xi < w; xi++) {
        const x = ltr ? xi : w - 1 - xi;
        const i = y * w + x;
        if (!opaque[i]) continue;
        const r = buf[i * 3];
        const g = buf[i * 3 + 1];
        const b = buf[i * 3 + 2];
        const c = nearestPal(rgbToLab(clamp(r), clamp(g), clamp(b)));
        cells[i] = c;
        const f = pal[c].floss;
        const er = (r - f.r) * k;
        const eg = (g - f.g) * k;
        const eb = (b - f.b) * k;
        for (const [dx0, dy, wt] of kernel) {
          const dx = ltr ? dx0 : -dx0;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= w || ny >= h) continue;
          const j = ny * w + nx;
          if (!opaque[j]) continue;
          buf[j * 3] += er * wt;
          buf[j * 3 + 1] += eg * wt;
          buf[j * 3 + 2] += eb * wt;
        }
      }
    }
  }

  progress("Cleaning up", 0.88);
  for (let pass = 0; pass < s.confetti; pass++) removeConfetti(cells, w, h, 5 - Math.min(pass, 1));

  // Merge rarely used colors away.
  const palLabs = pal.map((p) => p.lab);
  let counts = countCells(cells, pal.length);
  if (s.minStitches > 1) {
    const keep = counts.map((c) => c >= s.minStitches);
    if (keep.some(Boolean)) {
      const remap = pal.map((_, i) => {
        if (keep[i]) return i;
        let best = -1;
        let bestD = Infinity;
        for (let j = 0; j < pal.length; j++) {
          if (!keep[j]) continue;
          const d = dist(palLabs[i], palLabs[j]);
          if (d < bestD) {
            bestD = d;
            best = j;
          }
        }
        return best;
      });
      for (let i = 0; i < n; i++) if (cells[i] !== EMPTY) cells[i] = remap[cells[i]];
      counts = countCells(cells, pal.length);
    }
  }

  // Compact the palette (drop unused) and sort by usage.
  progress("Building legend", 0.95);
  const used = pal.map((_, i) => i).filter((i) => counts[i] > 0);
  used.sort((a, b) => counts[b] - counts[a]);
  const newIndex = new Uint16Array(pal.length).fill(EMPTY);
  used.forEach((old, ni) => (newIndex[old] = ni));
  for (let i = 0; i < n; i++) if (cells[i] !== EMPTY) cells[i] = newIndex[cells[i]];

  const palette: PaletteEntry[] = used.map((old, ni) => {
    const f = pal[old].floss;
    return {
      code: f.code,
      name: f.name,
      r: f.r,
      g: f.g,
      b: f.b,
      symbol: SYMBOLS[ni] ?? String(ni),
    };
  });

  progress("Done", 1);
  return { width: w, height: h, palette, cells };
}

function clamp(v: number) {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

function countCells(cells: Uint16Array, size: number): number[] {
  const counts = new Array(size).fill(0);
  for (let i = 0; i < cells.length; i++) if (cells[i] !== EMPTY) counts[cells[i]]++;
  return counts;
}

/** Replace isolated single stitches ("confetti") with the dominant neighbour color. */
function removeConfetti(cells: Uint16Array, w: number, h: number, threshold: number) {
  const src = new Uint16Array(cells);
  const tally = new Map<number, number>();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const c = src[i];
      if (c === EMPTY) continue;
      let same = 0;
      tally.clear();
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const v = src[ny * w + nx];
          if (v === c) same++;
          else if (v !== EMPTY) tally.set(v, (tally.get(v) ?? 0) + 1);
        }
      }
      if (same > 0) continue;
      let best = -1;
      let bestN = 0;
      for (const [v, k] of tally) if (k > bestN) [best, bestN] = [v, k];
      if (best >= 0 && bestN >= threshold - 2) cells[i] = best;
    }
  }
}
