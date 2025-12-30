import type { RGBColor } from '../../types/color';
import type { DMCThread } from '../../types/dmc';
import type { PatternCell } from '../../types/pattern';
import { findClosestColorIndex } from '../colorMatching/colorDistance';

/**
 * Average all pixels in a rectangular area
 */
function averagePixelsInArea(
  imageData: ImageData,
  x: number,
  y: number,
  width: number,
  height: number
): RGBColor {
  const data = imageData.data;
  const imageWidth = imageData.width;

  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  let count = 0;

  const endX = Math.min(x + width, imageData.width);
  const endY = Math.min(y + height, imageData.height);

  for (let py = y; py < endY; py++) {
    for (let px = x; px < endX; px++) {
      const index = (py * imageWidth + px) * 4;

      totalR += data[index];
      totalG += data[index + 1];
      totalB += data[index + 2];
      count++;
    }
  }

  if (count === 0) {
    return { r: 0, g: 0, b: 0 };
  }

  return {
    r: Math.round(totalR / count),
    g: Math.round(totalG / count),
    b: Math.round(totalB / count),
  };
}

/**
 * Find the closest DMC color in the palette for a given RGB color
 */
function findClosestDMCInPalette(color: RGBColor, palette: DMCThread[]): DMCThread {
  const paletteColors = palette.map(dmc => dmc.rgb);
  const closestIndex = findClosestColorIndex(color, paletteColors);
  return palette[closestIndex];
}

/**
 * Map an image to a grid of pattern cells using area averaging
 *
 * @param imageData - Source image data
 * @param gridWidth - Target grid width in stitches
 * @param gridHeight - Target grid height in stitches
 * @param dmcPalette - Palette of DMC colors to use (with symbols assigned)
 * @returns 2D array of PatternCells
 */
export function mapImageToGrid(
  imageData: ImageData,
  gridWidth: number,
  gridHeight: number,
  dmcPalette: DMCThread[]
): PatternCell[][] {
  if (dmcPalette.length === 0) {
    throw new Error('DMC palette cannot be empty');
  }

  if (gridWidth <= 0 || gridHeight <= 0) {
    throw new Error('Grid dimensions must be positive');
  }

  // Calculate scale factors
  const scaleX = imageData.width / gridWidth;
  const scaleY = imageData.height / gridHeight;

  // Create grid
  const grid: PatternCell[][] = [];

  for (let y = 0; y < gridHeight; y++) {
    grid[y] = [];

    for (let x = 0; x < gridWidth; x++) {
      // Calculate source rectangle in original image
      const srcX = Math.floor(x * scaleX);
      const srcY = Math.floor(y * scaleY);
      const srcWidth = Math.ceil(scaleX);
      const srcHeight = Math.ceil(scaleY);

      // Average all pixels in this area
      const avgColor = averagePixelsInArea(imageData, srcX, srcY, srcWidth, srcHeight);

      // Find closest color in DMC palette
      const closestDMC = findClosestDMCInPalette(avgColor, dmcPalette);

      // Create pattern cell
      grid[y][x] = {
        x,
        y,
        color: closestDMC,
        symbol: closestDMC.symbol || '?',
      };
    }
  }

  return grid;
}

/**
 * Resize image to exact grid dimensions using canvas
 * This is an alternative to area averaging - uses browser's built-in interpolation
 *
 * @param imageData - Source image data
 * @param gridWidth - Target width
 * @param gridHeight - Target height
 * @returns Resized ImageData
 */
export function resizeToGrid(
  imageData: ImageData,
  gridWidth: number,
  gridHeight: number
): ImageData {
  // Create source canvas
  const sourceCanvas = document.createElement('canvas');
  const sourceCtx = sourceCanvas.getContext('2d')!;
  sourceCanvas.width = imageData.width;
  sourceCanvas.height = imageData.height;
  sourceCtx.putImageData(imageData, 0, 0);

  // Create target canvas
  const targetCanvas = document.createElement('canvas');
  const targetCtx = targetCanvas.getContext('2d')!;
  targetCanvas.width = gridWidth;
  targetCanvas.height = gridHeight;

  // Draw resized image
  targetCtx.drawImage(
    sourceCanvas,
    0,
    0,
    imageData.width,
    imageData.height,
    0,
    0,
    gridWidth,
    gridHeight
  );

  return targetCtx.getImageData(0, 0, gridWidth, gridHeight);
}

/**
 * Map resized image to grid (simpler, faster alternative)
 * Assumes image is already resized to grid dimensions
 */
export function mapResizedImageToGrid(
  imageData: ImageData,
  dmcPalette: DMCThread[]
): PatternCell[][] {
  if (dmcPalette.length === 0) {
    throw new Error('DMC palette cannot be empty');
  }

  const { width, height } = imageData;
  const data = imageData.data;
  const grid: PatternCell[][] = [];

  for (let y = 0; y < height; y++) {
    grid[y] = [];

    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;

      const pixelColor: RGBColor = {
        r: data[index],
        g: data[index + 1],
        b: data[index + 2],
      };

      const closestDMC = findClosestDMCInPalette(pixelColor, dmcPalette);

      grid[y][x] = {
        x,
        y,
        color: closestDMC,
        symbol: closestDMC.symbol || '?',
      };
    }
  }

  return grid;
}

/**
 * Count how many times each DMC color is used in the grid
 * Useful for showing usage statistics
 */
export function countColorUsage(grid: PatternCell[][]): Map<string, number> {
  const usage = new Map<string, number>();

  for (const row of grid) {
    for (const cell of row) {
      const code = cell.color.code;
      usage.set(code, (usage.get(code) || 0) + 1);
    }
  }

  return usage;
}

/**
 * Get list of DMC colors actually used in the grid
 * May be fewer than the palette if some colors aren't used
 */
export function getUsedColors(grid: PatternCell[][]): DMCThread[] {
  const usedColorMap = new Map<string, DMCThread>();

  for (const row of grid) {
    for (const cell of row) {
      if (!usedColorMap.has(cell.color.code)) {
        usedColorMap.set(cell.color.code, cell.color);
      }
    }
  }

  return Array.from(usedColorMap.values());
}
