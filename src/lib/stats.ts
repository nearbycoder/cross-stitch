import { EMPTY, type Pattern } from "./types";

/** Number of full cross stitches one 8m skein of 6-strand floss covers. */
export function stitchesPerSkein(fabricCount: number, strands: number): number {
  const cellCm = 2.54 / fabricCount;
  // Two diagonals on the front plus roughly two cell edges of travel on the back.
  const perStitchCm = (2 * Math.SQRT2 + 2) * cellCm;
  const usableCm = (800 * 6) / Math.max(1, strands);
  const wasteFactor = 1.45; // starts, ends, travel between areas
  return Math.floor(usableCm / (perStitchCm * wasteFactor));
}

export function recommendedStrands(fabricCount: number): number {
  if (fabricCount <= 11) return 3;
  if (fabricCount >= 25) return 1;
  return 2;
}

export function colorCounts(p: Pattern): number[] {
  const counts = new Array(p.palette.length).fill(0);
  for (let i = 0; i < p.cells.length; i++) {
    const c = p.cells[i];
    if (c !== EMPTY && c < counts.length) counts[c]++;
  }
  return counts;
}

export function formatLength(inches: number, units: "in" | "cm"): string {
  return units === "cm" ? `${(inches * 2.54).toFixed(1)} cm` : `${inches.toFixed(1)}″`;
}

export function finishedSize(width: number, height: number, fabricCount: number) {
  return { w: width / fabricCount, h: height / fabricCount };
}

/** Fabric to buy: design plus 3" margin on every side for framing. */
export function fabricNeeded(width: number, height: number, fabricCount: number) {
  const s = finishedSize(width, height, fabricCount);
  return { w: s.w + 6, h: s.h + 6 };
}

/** Rough estimate of stitching time at ~1 minute per 2.5 stitches incl. thread changes. */
export function estimateHours(stitches: number, colors: number): number {
  return stitches / 150 + colors * 0.15;
}
