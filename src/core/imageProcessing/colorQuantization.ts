import type { RGBColor } from '../../types/color';

/**
 * Extract RGB colors from ImageData
 */
export function extractPixels(imageData: ImageData, sampleRate: number = 1): RGBColor[] {
  const pixels: RGBColor[] = [];
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4 * sampleRate) {
    pixels.push({
      r: data[i],
      g: data[i + 1],
      b: data[i + 2],
      // Skip alpha channel (data[i + 3])
    });
  }

  return pixels;
}

/**
 * Yield to browser to prevent UI freezing
 */
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

/**
 * Median Cut quantization - much faster than K-means
 * Divides color space into boxes and finds representative colors
 */
async function quantizeColorsMedianCut(
  imageData: ImageData,
  k: number,
  sampleRate: number = 1
): Promise<RGBColor[]> {
  const pixels = extractPixels(imageData, sampleRate);
  
  if (pixels.length === 0) {
    throw new Error('No pixels extracted from image');
  }

  if (k >= pixels.length) {
    const uniquePixels = new Map<string, RGBColor>();
    pixels.forEach(p => {
      const key = `${p.r},${p.g},${p.b}`;
      uniquePixels.set(key, p);
    });
    return Array.from(uniquePixels.values());
  }

  // Build color frequency map for better results
  const colorFreq = new Map<string, { color: RGBColor; count: number }>();
  for (const pixel of pixels) {
    const key = `${pixel.r},${pixel.g},${pixel.b}`;
    const existing = colorFreq.get(key);
    if (existing) {
      existing.count++;
    } else {
      colorFreq.set(key, { color: pixel, count: 1 });
    }
  }

  // Convert to weighted pixels
  const weightedPixels: Array<{ color: RGBColor; count: number }> = Array.from(colorFreq.values());
  
  // Initialize with one box containing all colors
  interface ColorBox {
    pixels: Array<{ color: RGBColor; count: number }>;
    rMin: number;
    rMax: number;
    gMin: number;
    gMax: number;
    bMin: number;
    bMax: number;
  }

  const boxes: ColorBox[] = [{
    pixels: weightedPixels,
    rMin: 0, rMax: 255,
    gMin: 0, gMax: 255,
    bMin: 0, bMax: 255,
  }];

  // Split boxes until we have k boxes
  while (boxes.length < k && boxes.length < weightedPixels.length) {
    // Find box with largest volume
    let maxVolume = -1;
    let boxToSplit = 0;
    
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      const volume = (box.rMax - box.rMin) * (box.gMax - box.gMin) * (box.bMax - box.bMin);
      if (volume > maxVolume && box.pixels.length > 1) {
        maxVolume = volume;
        boxToSplit = i;
      }
    }

    const box = boxes[boxToSplit];
    if (box.pixels.length <= 1) break;

    // Find longest dimension
    const rRange = box.rMax - box.rMin;
    const gRange = box.gMax - box.gMin;
    const bRange = box.bMax - box.bMin;
    
    let splitChannel: 'r' | 'g' | 'b';
    if (rRange >= gRange && rRange >= bRange) {
      splitChannel = 'r';
    } else if (gRange >= bRange) {
      splitChannel = 'g';
    } else {
      splitChannel = 'b';
    }

    // Sort pixels by the split channel
    box.pixels.sort((a, b) => a.color[splitChannel] - b.color[splitChannel]);

    // Split at median
    const median = Math.floor(box.pixels.length / 2);

    const leftPixels = box.pixels.slice(0, median);
    const rightPixels = box.pixels.slice(median);

    // Calculate actual min/max for each new box
    const calculateBounds = (pixels: Array<{ color: RGBColor; count: number }>) => {
      if (pixels.length === 0) {
        return { rMin: 0, rMax: 255, gMin: 0, gMax: 255, bMin: 0, bMax: 255 };
      }
      let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
      for (const { color } of pixels) {
        rMin = Math.min(rMin, color.r);
        rMax = Math.max(rMax, color.r);
        gMin = Math.min(gMin, color.g);
        gMax = Math.max(gMax, color.g);
        bMin = Math.min(bMin, color.b);
        bMax = Math.max(bMax, color.b);
      }
      return { rMin, rMax, gMin, gMax, bMin, bMax };
    };

    const leftBounds = calculateBounds(leftPixels);
    const rightBounds = calculateBounds(rightPixels);

    // Create new boxes
    const leftBox: ColorBox = {
      pixels: leftPixels,
      ...leftBounds,
    };

    const rightBox: ColorBox = {
      pixels: rightPixels,
      ...rightBounds,
    };

    // Replace old box with two new boxes
    boxes.splice(boxToSplit, 1, leftBox, rightBox);

    // Yield periodically
    if (boxes.length % 10 === 0) {
      await yieldToBrowser();
    }
  }

  // Calculate average color for each box
  const colors: RGBColor[] = [];
  for (const box of boxes) {
    if (box.pixels.length === 0) continue;
    
    let totalR = 0, totalG = 0, totalB = 0, totalWeight = 0;
    
    for (const { color, count } of box.pixels) {
      totalR += color.r * count;
      totalG += color.g * count;
      totalB += color.b * count;
      totalWeight += count;
    }
    
    colors.push({
      r: Math.round(totalR / totalWeight),
      g: Math.round(totalG / totalWeight),
      b: Math.round(totalB / totalWeight),
    });
  }

  return colors;
}

/**
 * Perform k-means clustering to reduce colors in an image (async version)
 * Now uses Median Cut by default for speed, falls back to K-means if needed
 *
 * @param imageData - ImageData from canvas
 * @param k - Number of colors to reduce to
 * @param maxIterations - Maximum iterations for K-means (default: 10, reduced for speed)
 * @param sampleRate - Sample every nth pixel for performance (default: 1 = all pixels)
 * @returns Array of k RGB colors representing the reduced palette
 */
export async function quantizeColors(
  imageData: ImageData,
  k: number,
  _maxIterations: number = 10,
  sampleRate: number = 1
): Promise<RGBColor[]> {
  // Validate inputs
  if (k <= 0) {
    throw new Error('k must be greater than 0');
  }

  if (k > 255) {
    throw new Error('k must be 255 or less');
  }

  // Use Median Cut for speed (much faster than K-means)
  const colors = await quantizeColorsMedianCut(imageData, k, sampleRate);
  
  return colors;
}

/**
 * Determine appropriate sample rate based on image size
 * For large images, we can sample fewer pixels to improve performance
 */
export function getOptimalSampleRate(width: number, height: number): number {
  const totalPixels = width * height;

  if (totalPixels > 1000000) {
    // > 1MP: sample every 5th pixel
    return 5;
  } else if (totalPixels > 500000) {
    // > 500K: sample every 3rd pixel
    return 3;
  } else if (totalPixels > 250000) {
    // > 250K: sample every 2nd pixel
    return 2;
  }

  // Default: use all pixels
  return 1;
}

/**
 * Apply quantized colors back to an image (async chunked version)
 * This replaces each pixel with its nearest quantized color
 */
export async function applyQuantizedColors(
  imageData: ImageData,
  quantizedColors: RGBColor[]
): Promise<ImageData> {
  const newImageData = new ImageData(
    new Uint8ClampedArray(imageData.data),
    imageData.width,
    imageData.height
  );

  const data = newImageData.data;
  const totalPixels = data.length / 4;
  
  // Detect mobile and use smaller chunks
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const chunkSize = isMobile ? 10000 : 50000; // Much smaller chunks on mobile

  // Pre-compute lookup table for faster matching
  const colorCache = new Map<string, RGBColor>();
  
  // Pre-compute squared distances for all quantized colors (avoid sqrt)
  const quantizedSquared = quantizedColors.map(c => ({
    color: c,
    r: c.r,
    g: c.g,
    b: c.b,
  }));

  for (let i = 0; i < totalPixels; i += chunkSize) {
    const end = Math.min(i + chunkSize, totalPixels);
    
    for (let j = i; j < end; j++) {
      const idx = j * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const pixelKey = `${r},${g},${b}`;
      
      let closestColor: RGBColor;
      
      // Check cache first
      if (colorCache.has(pixelKey)) {
        closestColor = colorCache.get(pixelKey)!;
      } else {
        // Find nearest quantized color using squared distance (faster)
        let minDistanceSq = Infinity;
        closestColor = quantizedColors[0];

        for (const q of quantizedSquared) {
          const dr = r - q.r;
          const dg = g - q.g;
          const db = b - q.b;
          const distanceSq = dr * dr + dg * dg + db * db;
          
          if (distanceSq < minDistanceSq) {
            minDistanceSq = distanceSq;
            closestColor = q.color;
          }
        }
        
        // Cache the result
        colorCache.set(pixelKey, closestColor);
      }

      // Replace pixel with quantized color
      data[idx] = closestColor.r;
      data[idx + 1] = closestColor.g;
      data[idx + 2] = closestColor.b;
      // Keep alpha channel unchanged
    }
    
    // Always yield after each chunk, more frequently on mobile
    await yieldToBrowser();
    if (isMobile) {
      await yieldToBrowser(); // Extra yield on mobile
    }
  }

  return newImageData;
}
