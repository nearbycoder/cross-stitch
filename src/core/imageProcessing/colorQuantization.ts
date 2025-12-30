import type { RGBColor } from '../../types/color';
import { euclideanDistance } from '../colorMatching/colorDistance';

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
 * Initialize k centroids using k-means++ algorithm (async version with yielding)
 * This provides better initial centroids than random selection
 */
async function initializeCentroidsKMeansPlusPlus(pixels: RGBColor[], k: number): Promise<RGBColor[]> {
  if (pixels.length === 0) {
    throw new Error('Cannot initialize centroids from empty pixel array');
  }

  if (k <= 0) {
    throw new Error('k must be greater than 0');
  }

  const centroids: RGBColor[] = [];

  // 1. Choose first centroid randomly
  const firstIndex = Math.floor(Math.random() * pixels.length);
  centroids.push({ ...pixels[firstIndex] });

  // 2. Choose remaining centroids with chunking for large pixel arrays
  const chunkSize = 10000; // Process 10k pixels at a time
  
  for (let i = 1; i < k; i++) {
    // Calculate distance from each pixel to nearest existing centroid (chunked)
    const distances: number[] = new Array(pixels.length);
    
    for (let chunkStart = 0; chunkStart < pixels.length; chunkStart += chunkSize) {
      const chunkEnd = Math.min(chunkStart + chunkSize, pixels.length);
      
      for (let j = chunkStart; j < chunkEnd; j++) {
        const pixel = pixels[j];
        let minDist = Infinity;
        for (const c of centroids) {
          const dist = euclideanDistance(pixel, c);
          if (dist < minDist) {
            minDist = dist;
          }
        }
        distances[j] = minDist;
      }
      
      // Yield between chunks
      await yieldToBrowser();
    }

    // Calculate total distance squared
    const totalDistanceSquared = distances.reduce((sum, d) => sum + d * d, 0);

    // Choose next centroid with probability proportional to distance²
    let random = Math.random() * totalDistanceSquared;

    for (let j = 0; j < pixels.length; j++) {
      random -= distances[j] * distances[j];
      if (random <= 0) {
        centroids.push({ ...pixels[j] });
        break;
      }
    }

    // Fallback: if we didn't select a centroid, pick randomly
    if (centroids.length !== i + 1) {
      const randomIndex = Math.floor(Math.random() * pixels.length);
      centroids.push({ ...pixels[randomIndex] });
    }
    
    // Yield after each centroid selection
    await yieldToBrowser();
  }

  return centroids;
}

/**
 * Assign each pixel to the nearest centroid
 * Returns array of cluster assignments (pixel index -> cluster index)
 */
function assignPixelsToClusters(pixels: RGBColor[], centroids: RGBColor[]): number[] {
  return pixels.map(pixel => {
    let minDistance = Infinity;
    let closestCluster = 0;

    for (let i = 0; i < centroids.length; i++) {
      const distance = euclideanDistance(pixel, centroids[i]);
      if (distance < minDistance) {
        minDistance = distance;
        closestCluster = i;
      }
    }

    return closestCluster;
  });
}

/**
 * Recalculate centroids as the mean of all pixels in each cluster
 * Optimized to avoid slow filter operations
 */
function recalculateCentroids(
  pixels: RGBColor[],
  assignments: number[],
  k: number
): RGBColor[] {
  const newCentroids: RGBColor[] = [];
  
  // Pre-allocate arrays for each cluster
  const clusterSums: Array<{ r: number; g: number; b: number; count: number }> = [];
  for (let i = 0; i < k; i++) {
    clusterSums[i] = { r: 0, g: 0, b: 0, count: 0 };
  }
  
  // Accumulate sums in a single pass (much faster than filter)
  for (let i = 0; i < pixels.length; i++) {
    const clusterIndex = assignments[i];
    const pixel = pixels[i];
    const sum = clusterSums[clusterIndex];
    sum.r += pixel.r;
    sum.g += pixel.g;
    sum.b += pixel.b;
    sum.count++;
  }
  
  // Calculate means
  for (let i = 0; i < k; i++) {
    const sum = clusterSums[i];
    
    if (sum.count === 0) {
      // If cluster is empty, pick a random pixel
      const randomPixel = pixels[Math.floor(Math.random() * pixels.length)];
      newCentroids.push({ ...randomPixel });
    } else {
      newCentroids.push({
        r: Math.round(sum.r / sum.count),
        g: Math.round(sum.g / sum.count),
        b: Math.round(sum.b / sum.count),
      });
    }
  }

  return newCentroids;
}

/**
 * Check if centroids have converged (changed very little)
 */
function centroidsConverged(
  oldCentroids: RGBColor[],
  newCentroids: RGBColor[],
  threshold: number = 1
): boolean {
  if (oldCentroids.length !== newCentroids.length) {
    return false;
  }

  for (let i = 0; i < oldCentroids.length; i++) {
    const distance = euclideanDistance(oldCentroids[i], newCentroids[i]);
    if (distance > threshold) {
      return false;
    }
  }

  return true;
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
 * Assign pixels to clusters with chunking for better performance
 */
async function assignPixelsToClustersChunked(
  pixels: RGBColor[],
  centroids: RGBColor[],
  chunkSize: number = 1000
): Promise<number[]> {
  const assignments: number[] = new Array(pixels.length);
  
  for (let i = 0; i < pixels.length; i += chunkSize) {
    const end = Math.min(i + chunkSize, pixels.length);
    
    for (let j = i; j < end; j++) {
      const pixel = pixels[j];
      let minDistance = Infinity;
      let closestCluster = 0;

      for (let k = 0; k < centroids.length; k++) {
        const distance = euclideanDistance(pixel, centroids[k]);
        if (distance < minDistance) {
          minDistance = distance;
          closestCluster = k;
        }
      }

      assignments[j] = closestCluster;
    }
    
    // Yield every chunk to prevent blocking (always yield, not just if more chunks remain)
    await yieldToBrowser();
  }
  
  return assignments;
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
    const medianValue = box.pixels[median].color[splitChannel];

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
  maxIterations: number = 10,
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
  const chunkSize = 50000; // Larger chunks since we're faster now
  const totalPixels = data.length / 4;

  // Pre-compute lookup table for faster matching
  // Use a simple hash-based lookup for RGB values
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
    
    // Yield less frequently since we're faster now
    if (i % (chunkSize * 4) === 0) {
      await yieldToBrowser();
    }
  }

  return newImageData;
}
