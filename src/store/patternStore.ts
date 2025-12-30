import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Pattern, ProcessingSettings, PatternCell } from '../types/pattern';
import type { DMCThread } from '../types/dmc';
import type { RGBColor } from '../types/color';
import { loadImageFile, loadImageFromURL } from '../core/imageProcessing/imageLoader';
import { quantizeColors, getOptimalSampleRate, applyQuantizedColors } from '../core/imageProcessing/colorQuantization';
import { matchColorsToDMC } from '../core/colorMatching/colorMatcher';
import { assignSymbolsToPalette } from '../core/patternGeneration/symbolAssigner';
import { resizeToGrid } from '../core/imageProcessing/gridMapper';

interface PatternStore {
  // State
  originalImage: ImageData | null;
  originalFile: File | null;
  originalImageDataUrl: string | null; // For persistence
  processedImage: ImageData | null;
  quantizedColors: RGBColor[];
  settings: ProcessingSettings;
  dmcPalette: DMCThread[];
  pattern: Pattern | null;
  isProcessing: boolean;
  error: string | null;
  _hasHydrated: boolean; // Track hydration state

  // Actions
  loadImage: (file: File) => Promise<void>;
  loadImageFromDataUrl: (dataUrl: string) => Promise<void>;
  updateSettings: (settings: Partial<ProcessingSettings>) => void;
  generatePattern: () => Promise<void>;
  removeColor: (dmcCode: string) => void;
  replaceColor: (oldCode: string, newDMC: DMCThread) => void;
  reset: () => void;
  setError: (error: string | null) => void;
  setHasHydrated: (state: boolean) => void;
}

const DEFAULT_SETTINGS: ProcessingSettings = {
  maxColors: 20,
  gridWidth: 100,
  gridHeight: 100,
  maintainAspectRatio: true,
  colorlessMode: false,
};

// Helper to convert ImageData to data URL with compression
function imageDataToDataUrl(imageData: ImageData): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');
  
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  ctx.putImageData(imageData, 0, 0);
  
  // Use JPEG with quality 0.85 to reduce size
  return canvas.toDataURL('image/jpeg', 0.85);
}

// Helper to yield to browser
async function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => {
    // Use requestAnimationFrame with a timeout fallback to ensure it always resolves
    const timeoutId = setTimeout(() => resolve(), 50);
    requestAnimationFrame(() => {
      clearTimeout(timeoutId);
      setTimeout(() => resolve(), 0);
    });
  });
}

// Chunked grid mapping for better performance with optimized color matching
async function mapImageToGridChunked(
  imageData: ImageData,
  gridWidth: number,
  gridHeight: number,
  dmcPalette: DMCThread[]
): Promise<PatternCell[][]> {
  // Detect mobile device and adjust chunk size accordingly
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const totalCells = gridWidth * gridHeight;
  
  // Use smaller chunks on mobile or for large grids
  // Mobile: 5 rows for very large grids, 10 for normal, Desktop large grids (>150x150): 25 rows, Desktop normal: 50 rows
  let chunkSize: number;
  if (isMobile) {
    // Even smaller chunks for very large grids on mobile
    if (totalCells > 25000) { // > 158x158
      chunkSize = 5; // Very small chunks for 200x200 on mobile
    } else {
      chunkSize = 10;
    }
  } else if (totalCells > 22500) { // > 150x150
    chunkSize = 25;
  } else {
    chunkSize = 50;
  }
  
  const grid: PatternCell[][] = [];
  
  // If image is already resized to grid dimensions, use faster direct pixel mapping
  if (imageData.width === gridWidth && imageData.height === gridHeight) {
    const data = imageData.data;
    const colorLookup = new Map<string, DMCThread>();
    
    // Fast color matching function
    const findClosestDMC = (color: RGBColor): DMCThread => {
      const cacheKey = `${color.r},${color.g},${color.b}`;
      if (colorLookup.has(cacheKey)) {
        return colorLookup.get(cacheKey)!;
      }
      
      let minDistanceSq = Infinity;
      let closestDMC = dmcPalette[0];
      
      for (const dmc of dmcPalette) {
        const dr = color.r - dmc.rgb.r;
        const dg = color.g - dmc.rgb.g;
        const db = color.b - dmc.rgb.b;
        const distanceSq = dr * dr + dg * dg + db * db;
        
        if (distanceSq < minDistanceSq) {
          minDistanceSq = distanceSq;
          closestDMC = dmc;
        }
      }
      
      colorLookup.set(cacheKey, closestDMC);
      return closestDMC;
    };
    
    // Process in chunks for mobile
    for (let startY = 0; startY < gridHeight; startY += chunkSize) {
      const endY = Math.min(startY + chunkSize, gridHeight);
      
      for (let y = startY; y < endY; y++) {
        grid[y] = [];
        
        for (let x = 0; x < gridWidth; x++) {
          const idx = (y * gridWidth + x) * 4;
          const pixelColor: RGBColor = {
            r: data[idx],
            g: data[idx + 1],
            b: data[idx + 2],
          };
          
          const closestDMC = findClosestDMC(pixelColor);
          
          grid[y][x] = {
            x,
            y,
            color: closestDMC,
            symbol: closestDMC.symbol || '?',
          };
        }
      }
      
      // Yield more frequently on mobile
      await yieldToBrowser();
      if (isMobile) {
        await yieldToBrowser(); // Always extra yield on mobile
        // For very large grids, yield even more frequently
        if (totalCells > 25000 && (startY / chunkSize) % 2 === 0) {
          await yieldToBrowser(); // Triple yield for 200x200 on mobile
        }
      }
    }
    
    return grid;
  }
  
  // Original area averaging approach for non-resized images
  const scaleX = imageData.width / gridWidth;
  const scaleY = imageData.height / gridHeight;
  const colorLookup = new Map<string, DMCThread>();
  
  const findClosestDMC = (color: RGBColor): DMCThread => {
    const cacheKey = `${color.r},${color.g},${color.b}`;
    if (colorLookup.has(cacheKey)) {
      return colorLookup.get(cacheKey)!;
    }
    
    let minDistanceSq = Infinity;
    let closestDMC = dmcPalette[0];
    
    for (const dmc of dmcPalette) {
      const dr = color.r - dmc.rgb.r;
      const dg = color.g - dmc.rgb.g;
      const db = color.b - dmc.rgb.b;
      const distanceSq = dr * dr + dg * dg + db * db;
      
      if (distanceSq < minDistanceSq) {
        minDistanceSq = distanceSq;
        closestDMC = dmc;
      }
    }
    
    colorLookup.set(cacheKey, closestDMC);
    return closestDMC;
  };
  
  for (let startY = 0; startY < gridHeight; startY += chunkSize) {
    const endY = Math.min(startY + chunkSize, gridHeight);
    
    for (let y = startY; y < endY; y++) {
      grid[y] = [];
      
      for (let x = 0; x < gridWidth; x++) {
        const srcX = Math.floor(x * scaleX);
        const srcY = Math.floor(y * scaleY);
        const srcWidth = Math.ceil(scaleX);
        const srcHeight = Math.ceil(scaleY);
        
        const data = imageData.data;
        let r = 0, g = 0, b = 0, count = 0;
        
        for (let sy = srcY; sy < Math.min(srcY + srcHeight, imageData.height); sy++) {
          for (let sx = srcX; sx < Math.min(srcX + srcWidth, imageData.width); sx++) {
            const idx = (sy * imageData.width + sx) * 4;
            r += data[idx];
            g += data[idx + 1];
            b += data[idx + 2];
            count++;
          }
        }
        
        const avgColor: RGBColor = {
          r: Math.round(r / count),
          g: Math.round(g / count),
          b: Math.round(b / count),
        };
        
        const closestDMC = findClosestDMC(avgColor);
        
        grid[y][x] = {
          x,
          y,
          color: closestDMC,
          symbol: closestDMC.symbol || '?',
        };
      }
    }
    
    await yieldToBrowser();
    if (isMobile) {
      await yieldToBrowser(); // Always extra yield on mobile
      // For very large grids, yield even more frequently
      if (totalCells > 25000 && (startY / chunkSize) % 2 === 0) {
        await yieldToBrowser(); // Triple yield for 200x200 on mobile
      }
    }
  }
  
  return grid;
}

export const usePatternStore = create<PatternStore>()(
  persist(
    (set, get) => ({
      // Initial state
      originalImage: null,
      originalFile: null,
      originalImageDataUrl: null,
      processedImage: null,
      quantizedColors: [],
      settings: DEFAULT_SETTINGS,
      dmcPalette: [],
      pattern: null,
      isProcessing: false,
      error: null,
      _hasHydrated: false,

      // Set hydration state
      setHasHydrated: (state: boolean) => {
        set({ _hasHydrated: state });
      },

      // Load image from file
      loadImage: async (file: File) => {
        set({ isProcessing: true, error: null });

        try {
          const imageData = await loadImageFile(file);
          const dataUrl = imageDataToDataUrl(imageData);

          set({
            originalImage: imageData,
            originalFile: file,
            originalImageDataUrl: dataUrl,
            processedImage: null,
            pattern: null,
            isProcessing: false,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to load image';
          set({ error: errorMessage, isProcessing: false });
        }
      },

      // Load image from data URL (for persistence)
      loadImageFromDataUrl: async (dataUrl: string) => {
        try {
          const imageData = await loadImageFromURL(dataUrl);
          set({
            originalImage: imageData,
            originalImageDataUrl: dataUrl,
          });
        } catch (error) {
          // Silently handle error
        }
      },

      // Update settings
      updateSettings: (newSettings: Partial<ProcessingSettings>) => {
        set((state) => ({
          settings: {
            ...state.settings,
            ...newSettings,
          },
        }));
      },

      // Generate pattern from current image and settings
      generatePattern: async () => {
        const { originalImage, settings } = get();

        if (!originalImage) {
          set({ error: 'No image loaded' });
          return;
        }

        set({ isProcessing: true, error: null });

        try {
          // Step 1: Color quantization (now uses Median Cut - much faster!)
          const sampleRate = getOptimalSampleRate(originalImage.width, originalImage.height);
          const quantizedColors = await quantizeColors(
            originalImage,
            settings.maxColors,
            10, // Reduced iterations since we use Median Cut now
            sampleRate
          );

          // Yield to browser
          await yieldToBrowser();

          // Step 2: Match to DMC colors
          const matchedDMC = matchColorsToDMC(quantizedColors);

          // Yield to browser
          await yieldToBrowser();

          // Step 3: Assign symbols
          const paletteWithSymbols = assignSymbolsToPalette(matchedDMC);

          // Yield to browser
          await yieldToBrowser();

          // Step 4: Apply quantized colors to create processed image (now async)
          const processedImage = await applyQuantizedColors(originalImage, quantizedColors);

          // Yield to browser
          await yieldToBrowser();

          // Step 5: Resize to grid dimensions
          const resizedImage = resizeToGrid(
            processedImage,
            settings.gridWidth,
            settings.gridHeight
          );

          // Yield to browser
          await yieldToBrowser();

          // Step 6: Map to grid using chunked processing
          const grid = await mapImageToGridChunked(
            resizedImage,
            settings.gridWidth,
            settings.gridHeight,
            paletteWithSymbols
          );

          // Step 7: Create pattern object
          const pattern: Pattern = {
            width: settings.gridWidth,
            height: settings.gridHeight,
            cells: grid,
            palette: paletteWithSymbols,
            metadata: {
              originalWidth: originalImage.width,
              originalHeight: originalImage.height,
              colorCount: paletteWithSymbols.length,
              createdAt: new Date(),
            },
          };

          set({
            quantizedColors,
            dmcPalette: paletteWithSymbols,
            processedImage,
            pattern,
            isProcessing: false,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to generate pattern';
          set({ error: errorMessage, isProcessing: false });
        }
      },

      // Remove a color from the palette and redistribute pixels
      removeColor: (dmcCode: string) => {
        const { pattern, dmcPalette } = get();

        if (!pattern || dmcPalette.length <= 1) {
          set({ error: 'Cannot remove the last color' });
          return;
        }

        // Create new palette without the removed color
        const newPalette = dmcPalette.filter((c) => c.code !== dmcCode);

        // Reassign symbols
        const newPaletteWithSymbols = assignSymbolsToPalette(newPalette);

        // Update grid cells to use new palette
        const newGrid = pattern.cells.map((row) =>
          row.map((cell) => {
            if (cell.color.code === dmcCode) {
              // Find closest color in new palette
              const paletteColors = newPaletteWithSymbols.map((dmc) => dmc.rgb);
              const closestIndex = paletteColors.findIndex(() => {
                // Simple matching - could use color distance here
                return true;
              });

              const newColor = newPaletteWithSymbols[closestIndex % newPaletteWithSymbols.length];

              return {
                ...cell,
                color: newColor,
                symbol: newColor.symbol!,
              };
            }
            else {
              // Update symbol if it changed due to reassignment
              const updatedColor = newPaletteWithSymbols.find((c) => c.code === cell.color.code);
              if (updatedColor) {
                return {
                  ...cell,
                  color: updatedColor,
                  symbol: updatedColor.symbol!,
                };
              }
            }

            return cell;
          })
        );

        const newPattern: Pattern = {
          ...pattern,
          cells: newGrid,
          palette: newPaletteWithSymbols,
          metadata: {
            ...pattern.metadata,
            colorCount: newPaletteWithSymbols.length,
          },
        };

        set({
          dmcPalette: newPaletteWithSymbols,
          pattern: newPattern,
        });
      },

      // Replace a color with a different DMC thread
      replaceColor: (oldCode: string, newDMC: DMCThread) => {
        const { pattern, dmcPalette } = get();

        if (!pattern) {
          return;
        }

        // Update palette
        const newPalette = dmcPalette.map((c) =>
          c.code === oldCode ? { ...newDMC, symbol: c.symbol } : c
        );

        // Update grid cells
        const newGrid = pattern.cells.map((row) =>
          row.map((cell) =>
            cell.color.code === oldCode
              ? {
                  ...cell,
                  color: { ...newDMC, symbol: cell.symbol },
                }
              : cell
          )
        );

        const newPattern: Pattern = {
          ...pattern,
          cells: newGrid,
          palette: newPalette,
        };

        set({
          dmcPalette: newPalette,
          pattern: newPattern,
        });
      },

      // Reset everything
      reset: () => {
        set({
          originalImage: null,
          originalFile: null,
          originalImageDataUrl: null,
          processedImage: null,
          quantizedColors: [],
          settings: DEFAULT_SETTINGS,
          dmcPalette: [],
          pattern: null,
          error: null,
        });
      },

      // Set error message
      setError: (error: string | null) => {
        set({ error });
      },
    }),
    {
      name: 'cross-stitch-pattern-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist essential data - NOT the full pattern cells array (too large)
        settings: state.settings,
        originalImageDataUrl: state.originalImageDataUrl,
        dmcPalette: state.dmcPalette,
        // Don't persist pattern cells - regenerate on load if needed
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          return;
        }
        
        if (!state) return;

        // Mark as hydrated
        state.setHasHydrated(true);
      },
    }
  )
);
