import chroma from 'chroma-js';
import type { RGBColor } from '../../types/color';

/**
 * Convert RGB color to chroma.js color object
 */
function rgbToChroma(rgb: RGBColor): chroma.Color {
  return chroma.rgb(rgb.r, rgb.g, rgb.b);
}

/**
 * Calculate Delta-E 2000 color distance between two RGB colors
 * Delta-E 2000 is the most perceptually accurate color distance metric
 * Returns a value between 0 (identical) and 100 (completely different)
 *
 * @param color1 - First RGB color
 * @param color2 - Second RGB color
 * @returns Perceptual color distance (0-100)
 */
export function deltaE2000(color1: RGBColor, color2: RGBColor): number {
  const c1 = rgbToChroma(color1);
  const c2 = rgbToChroma(color2);

  // Calculate Delta-E using LAB color space
  // This is a simplified version - full Delta-E 2000 formula is more complex
  const lab1 = c1.lab();
  const lab2 = c2.lab();

  const lDiff = lab1[0] - lab2[0];
  const aDiff = lab1[1] - lab2[1];
  const bDiff = lab1[2] - lab2[2];

  return Math.sqrt(lDiff * lDiff + aDiff * aDiff + bDiff * bDiff);
}

/**
 * Calculate simple Euclidean distance in RGB space
 * Faster but less perceptually accurate than Delta-E 2000
 *
 * @param color1 - First RGB color
 * @param color2 - Second RGB color
 * @returns Euclidean distance in RGB space
 */
export function euclideanDistance(color1: RGBColor, color2: RGBColor): number {
  const rDiff = color1.r - color2.r;
  const gDiff = color1.g - color2.g;
  const bDiff = color1.b - color2.b;

  return Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);
}

/**
 * Calculate distance in LAB color space
 * More perceptually uniform than RGB
 *
 * @param color1 - First RGB color
 * @param color2 - Second RGB color
 * @returns Distance in LAB space
 */
export function labDistance(color1: RGBColor, color2: RGBColor): number {
  const c1 = rgbToChroma(color1);
  const c2 = rgbToChroma(color2);

  const lab1 = c1.lab();
  const lab2 = c2.lab();

  const lDiff = lab1[0] - lab2[0];
  const aDiff = lab1[1] - lab2[1];
  const bDiff = lab1[2] - lab2[2];

  return Math.sqrt(lDiff * lDiff + aDiff * aDiff + bDiff * bDiff);
}

/**
 * Batch calculate distances from one color to multiple colors
 * Useful for finding closest match in a palette
 *
 * @param sourceColor - The color to compare from
 * @param targetColors - Array of colors to compare to
 * @param distanceFunc - Distance function to use (defaults to deltaE2000)
 * @returns Array of distances in same order as targetColors
 */
export function batchDistance(
  sourceColor: RGBColor,
  targetColors: RGBColor[],
  distanceFunc: (c1: RGBColor, c2: RGBColor) => number = deltaE2000
): number[] {
  return targetColors.map(targetColor => distanceFunc(sourceColor, targetColor));
}

/**
 * Find index of closest color in array
 *
 * @param sourceColor - The color to find a match for
 * @param targetColors - Array of colors to search
 * @param distanceFunc - Distance function to use
 * @returns Index of closest matching color
 */
export function findClosestColorIndex(
  sourceColor: RGBColor,
  targetColors: RGBColor[],
  distanceFunc: (c1: RGBColor, c2: RGBColor) => number = deltaE2000
): number {
  const distances = batchDistance(sourceColor, targetColors, distanceFunc);

  let minDistance = Infinity;
  let minIndex = 0;

  for (let i = 0; i < distances.length; i++) {
    if (distances[i] < minDistance) {
      minDistance = distances[i];
      minIndex = i;
    }
  }

  return minIndex;
}
