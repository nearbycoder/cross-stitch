import dmcColorsData from '../../data/dmcColors.json';
import type { DMCThread, DMCColorData } from '../../types/dmc';

// Load and parse DMC colors
const dmcColors: DMCThread[] = (dmcColorsData as DMCColorData[]).map(color => ({
  ...color,
  symbol: undefined, // Symbols will be assigned during pattern generation
}));

/**
 * Get all available DMC thread colors
 */
export function getAllDMCColors(): DMCThread[] {
  return dmcColors;
}

/**
 * Get DMC color by code
 */
export function getDMCByCode(code: string): DMCThread | undefined {
  return dmcColors.find(color => color.code === code);
}

/**
 * Get multiple DMC colors by codes
 */
export function getDMCByCodes(codes: string[]): DMCThread[] {
  return codes
    .map(code => getDMCByCode(code))
    .filter((color): color is DMCThread => color !== undefined);
}

/**
 * Search DMC colors by name (case-insensitive, partial match)
 */
export function searchDMCByName(query: string): DMCThread[] {
  const lowerQuery = query.toLowerCase();
  return dmcColors.filter(color =>
    color.name.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get DMC colors in a specific color family
 * This is a simple implementation - could be enhanced with better color categorization
 */
export function getDMCByColorFamily(family: string): DMCThread[] {
  const lowerFamily = family.toLowerCase();
  return dmcColors.filter(color =>
    color.name.toLowerCase().includes(lowerFamily)
  );
}

/**
 * Get total number of DMC colors in database
 */
export function getDMCColorCount(): number {
  return dmcColors.length;
}

export default dmcColors;
