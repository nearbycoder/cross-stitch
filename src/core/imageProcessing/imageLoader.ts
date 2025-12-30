/**
 * Validate if a file is a supported image type
 */
export function validateImageFile(file: File): boolean {
  const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  return supportedTypes.includes(file.type);
}

/**
 * Validate image file size (default: 10MB max)
 */
export function validateImageSize(file: File, maxSizeBytes: number = 10 * 1024 * 1024): boolean {
  return file.size <= maxSizeBytes;
}

/**
 * Load an image file and convert to ImageData
 *
 * @param file - Image file to load
 * @returns Promise resolving to ImageData
 */
export async function loadImageFile(file: File): Promise<ImageData> {
  // Validate file type
  if (!validateImageFile(file)) {
    throw new Error('Unsupported image format. Please use JPEG, PNG, GIF, or WebP.');
  }

  // Validate file size
  if (!validateImageSize(file)) {
    throw new Error('Image file is too large. Maximum size is 10MB.');
  }

  // Create image element
  const img = new Image();
  const url = URL.createObjectURL(file);

  try {
    // Load image
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = url;
    });

    // Create canvas and get context
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // Set canvas size to image size
    canvas.width = img.width;
    canvas.height = img.height;

    // Draw image to canvas
    ctx.drawImage(img, 0, 0);

    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    return imageData;
  } finally {
    // Clean up object URL
    URL.revokeObjectURL(url);
  }
}

/**
 * Load an image from a URL and convert to ImageData
 *
 * @param url - Image URL to load
 * @returns Promise resolving to ImageData
 */
export async function loadImageFromURL(url: string): Promise<ImageData> {
  const img = new Image();
  img.crossOrigin = 'anonymous'; // Enable CORS if needed

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load image from URL'));
    img.src = url;
  });

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);

  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * Resize an image to fit within max dimensions while maintaining aspect ratio
 *
 * @param imageData - Original image data
 * @param maxWidth - Maximum width
 * @param maxHeight - Maximum height
 * @returns Resized ImageData
 */
export function resizeImage(
  imageData: ImageData,
  maxWidth: number,
  maxHeight: number
): ImageData {
  const { width, height } = imageData;

  // Calculate new dimensions while maintaining aspect ratio
  let newWidth = width;
  let newHeight = height;

  if (width > maxWidth || height > maxHeight) {
    const widthRatio = maxWidth / width;
    const heightRatio = maxHeight / height;
    const ratio = Math.min(widthRatio, heightRatio);

    newWidth = Math.round(width * ratio);
    newHeight = Math.round(height * ratio);
  }

  // Create canvases for resizing
  const sourceCanvas = document.createElement('canvas');
  const sourceCtx = sourceCanvas.getContext('2d')!;
  sourceCanvas.width = width;
  sourceCanvas.height = height;
  sourceCtx.putImageData(imageData, 0, 0);

  const targetCanvas = document.createElement('canvas');
  const targetCtx = targetCanvas.getContext('2d')!;
  targetCanvas.width = newWidth;
  targetCanvas.height = newHeight;

  // Draw resized image
  targetCtx.drawImage(sourceCanvas, 0, 0, width, height, 0, 0, newWidth, newHeight);

  return targetCtx.getImageData(0, 0, newWidth, newHeight);
}

/**
 * Get image dimensions from ImageData
 */
export function getImageDimensions(imageData: ImageData): { width: number; height: number } {
  return {
    width: imageData.width,
    height: imageData.height,
  };
}

/**
 * Calculate grid dimensions while maintaining aspect ratio
 */
export function calculateGridDimensions(
  imageWidth: number,
  imageHeight: number,
  targetStitches: number,
  maintainAspectRatio: boolean = true
): { width: number; height: number } {
  if (!maintainAspectRatio) {
    return { width: targetStitches, height: targetStitches };
  }

  const aspectRatio = imageWidth / imageHeight;

  let gridWidth: number;
  let gridHeight: number;

  if (aspectRatio >= 1) {
    // Landscape or square
    gridWidth = targetStitches;
    gridHeight = Math.round(targetStitches / aspectRatio);
  } else {
    // Portrait
    gridHeight = targetStitches;
    gridWidth = Math.round(targetStitches * aspectRatio);
  }

  return { width: gridWidth, height: gridHeight };
}
