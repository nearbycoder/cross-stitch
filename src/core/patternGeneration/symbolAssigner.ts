import type { DMCThread } from '../../types/dmc';
import { getAllSymbols, getSymbolCount } from '../../data/symbols';

/**
 * Assign unique symbols to DMC colors in a palette
 *
 * @param palette - Array of DMC colors to assign symbols to
 * @returns New array with symbols assigned
 */
export function assignSymbolsToPalette(palette: DMCThread[]): DMCThread[] {
  const symbols = getAllSymbols();
  const maxSymbols = getSymbolCount();

  // If palette has more colors than symbols, symbols will be reused

  return palette.map((color, index) => ({
    ...color,
    symbol: symbols[index % symbols.length],
  }));
}

/**
 * Assign symbols to palette, prioritizing most-used colors for simpler symbols
 * This requires usage statistics
 *
 * @param palette - Array of DMC colors
 * @param usageCounts - Map of DMC code to usage count
 * @returns New array with symbols assigned
 */
export function assignSymbolsByUsage(
  palette: DMCThread[],
  usageCounts: Map<string, number>
): DMCThread[] {
  const symbols = getAllSymbols();

  // Sort palette by usage count (most used first)
  const sortedPalette = [...palette].sort((a, b) => {
    const countA = usageCounts.get(a.code) || 0;
    const countB = usageCounts.get(b.code) || 0;
    return countB - countA; // Descending order
  });

  // Assign symbols
  return sortedPalette.map((color, index) => ({
    ...color,
    symbol: symbols[index % symbols.length],
  }));
}

/**
 * Get recommended symbol based on color brightness
 * Filled symbols for dark colors, outline symbols for light colors
 *
 * @param color - DMC thread color
 * @param symbolIndex - Index in symbol array
 * @returns Recommended symbol
 */
export function getSymbolForColor(_color: DMCThread, symbolIndex: number): string {
  const symbols = getAllSymbols();

  // For future enhancement: could calculate brightness and select symbols based on it
  // const { r, g, b } = color.rgb;
  // const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  // For very light colors, prefer outline symbols
  // For dark colors, prefer filled symbols

  const symbol = symbols[symbolIndex % symbols.length];

  return symbol;
}

/**
 * Reassign a specific color's symbol
 *
 * @param palette - Current palette
 * @param dmcCode - Code of the color to reassign
 * @param newSymbol - New symbol to assign
 * @returns Updated palette
 */
export function reassignSymbol(
  palette: DMCThread[],
  dmcCode: string,
  newSymbol: string
): DMCThread[] {
  return palette.map(color =>
    color.code === dmcCode
      ? { ...color, symbol: newSymbol }
      : color
  );
}

/**
 * Check if all colors in palette have unique symbols
 */
export function hasUniqueSymbols(palette: DMCThread[]): boolean {
  const symbols = new Set<string>();

  for (const color of palette) {
    if (!color.symbol) {
      return false;
    }

    if (symbols.has(color.symbol)) {
      return false;
    }

    symbols.add(color.symbol);
  }

  return true;
}

/**
 * Get symbol for a DMC code from a palette
 */
export function getSymbolForDMC(palette: DMCThread[], dmcCode: string): string | undefined {
  const color = palette.find(c => c.code === dmcCode);
  return color?.symbol;
}

/**
 * Create a symbol legend mapping symbols to DMC info
 */
export function createSymbolLegend(palette: DMCThread[]): Array<{
  symbol: string;
  dmc: DMCThread;
}> {
  return palette
    .filter(color => color.symbol !== undefined)
    .map(color => ({
      symbol: color.symbol!,
      dmc: color,
    }));
}
