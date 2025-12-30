import type { RGBColor } from '../../types/color';
import type { DMCThread } from '../../types/dmc';
import { getAllDMCColors } from './dmcDatabase';
import { deltaE2000, findClosestColorIndex } from './colorDistance';

// Cache for color matching to improve performance
const matchCache = new Map<string, DMCThread>();

/**
 * Generate cache key from RGB color
 */
function getCacheKey(color: RGBColor): string {
  return `${color.r},${color.g},${color.b}`;
}

/**
 * Match a single RGB color to the closest DMC thread
 *
 * @param color - RGB color to match
 * @param useCache - Whether to use caching (default: true)
 * @returns Closest matching DMC thread
 */
export function matchColorToDMC(color: RGBColor, useCache = true): DMCThread {
  // Check cache first
  if (useCache) {
    const cacheKey = getCacheKey(color);
    const cached = matchCache.get(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const allDMCColors = getAllDMCColors();
  const dmcRGBColors = allDMCColors.map(dmc => dmc.rgb);

  const closestIndex = findClosestColorIndex(color, dmcRGBColors, deltaE2000);
  const matched = allDMCColors[closestIndex];

  // Cache the result
  if (useCache) {
    matchCache.set(getCacheKey(color), matched);
  }

  return matched;
}

/**
 * Match multiple RGB colors to DMC threads
 *
 * @param colors - Array of RGB colors to match
 * @param useCache - Whether to use caching
 * @returns Array of matched DMC threads
 */
export function matchColorsToDMC(colors: RGBColor[], useCache = true): DMCThread[] {
  return colors.map(color => matchColorToDMC(color, useCache));
}

/**
 * Match colors and remove duplicates
 * When multiple quantized colors match to the same DMC color, keep only one
 *
 * @param colors - Array of RGB colors to match
 * @returns Array of unique matched DMC threads
 */
export function matchColorsToUniqueDMC(colors: RGBColor[]): DMCThread[] {
  const matched = matchColorsToDMC(colors);

  // Remove duplicates based on DMC code
  const uniqueMap = new Map<string, DMCThread>();
  matched.forEach(dmc => {
    if (!uniqueMap.has(dmc.code)) {
      uniqueMap.set(dmc.code, dmc);
    }
  });

  return Array.from(uniqueMap.values());
}

/**
 * Find the n closest DMC colors to a given RGB color
 * Useful for showing alternatives to the user
 *
 * @param color - RGB color to match
 * @param n - Number of matches to return
 * @returns Array of n closest DMC threads with distances
 */
export function findNClosestDMC(
  color: RGBColor,
  n: number = 5
): Array<{ dmc: DMCThread; distance: number }> {
  const allDMCColors = getAllDMCColors();

  // Calculate distances to all DMC colors
  const withDistances = allDMCColors.map(dmc => ({
    dmc,
    distance: deltaE2000(color, dmc.rgb),
  }));

  // Sort by distance and take top n
  withDistances.sort((a, b) => a.distance - b.distance);

  return withDistances.slice(0, n);
}

/**
 * Match a color to DMC threads within a specific distance threshold
 * Returns all DMC colors that are "close enough"
 *
 * @param color - RGB color to match
 * @param maxDistance - Maximum acceptable Delta-E distance (default: 10)
 * @returns Array of acceptable DMC matches
 */
export function matchColorWithThreshold(
  color: RGBColor,
  maxDistance: number = 10
): DMCThread[] {
  const allDMCColors = getAllDMCColors();

  return allDMCColors.filter(dmc => {
    const distance = deltaE2000(color, dmc.rgb);
    return distance <= maxDistance;
  });
}

/**
 * Clear the color matching cache
 * Useful when memory needs to be freed
 */
export function clearMatchCache(): void {
  matchCache.clear();
}

/**
 * Get cache size
 */
export function getMatchCacheSize(): number {
  return matchCache.size;
}
