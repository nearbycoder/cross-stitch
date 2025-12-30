import { useEffect, useRef, useState, useCallback } from 'react';
import { usePatternStore } from '../store/patternStore';
import { Palette, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { Button } from './ui/button';

// Helper function to calculate luminance of a hex color
function getLuminance(hex: string): number {
  const rgb = hex.match(/^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!rgb) return 0.5;

  const r = parseInt(rgb[1], 16) / 255;
  const g = parseInt(rgb[2], 16) / 255;
  const b = parseInt(rgb[3], 16) / 255;

  // Apply gamma correction
  const [rLinear, gLinear, bLinear] = [r, g, b].map((val) => {
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });

  // Calculate relative luminance
  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

// Get appropriate text color based on background color
function getTextColor(backgroundColor: string): string {
  const luminance = getLuminance(backgroundColor);
  // Use dark text on light backgrounds, light text on dark backgrounds
  return luminance > 0.5 ? '#000' : '#fff';
}

export function PatternPreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { pattern, settings } = usePatternStore();
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [touchStart, setTouchStart] = useState<{ x: number; y: number; distance: number } | null>(null);
  const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null);
  const baseCellSize = 20; // Fixed base cell size for consistent rendering

  // Handle zoom with mouse wheel
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.1, Math.min(10, zoom * delta));

      // Zoom towards mouse position
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const worldX = (mouseX - panX) / zoom;
        const worldY = (mouseY - panY) / zoom;

        setPanX(mouseX - worldX * newZoom);
        setPanY(mouseY - worldY * newZoom);
        setZoom(newZoom);
      } else {
        setZoom(newZoom);
      }
    },
    [zoom, panX, panY]
  );

  // Handle mouse down for panning
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 0) {
        // Left mouse button
        setIsDragging(true);
        setDragStart({ x: e.clientX - panX, y: e.clientY - panY });
      }
    },
    [panX, panY]
  );

  // Handle touch start
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
        // Single touch - pan
        const touch = e.touches[0];
        setIsDragging(true);
        setDragStart({ x: touch.clientX - panX, y: touch.clientY - panY });
      } else if (e.touches.length === 2) {
        // Two touches - pinch to zoom
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const distance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );
        setTouchStart({
          x: (touch1.clientX + touch2.clientX) / 2,
          y: (touch1.clientY + touch2.clientY) / 2,
          distance,
        });
        setLastTouchDistance(distance);
      }
    },
    [panX, panY]
  );

  // Handle mouse move for panning
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && !touchStart) {
        setPanX(e.clientX - dragStart.x);
        setPanY(e.clientY - dragStart.y);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging && !touchStart) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragStart, touchStart]);

  // Handle touch move
  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1 && isDragging && !touchStart) {
        // Single touch pan
        const touch = e.touches[0];
        setPanX(touch.clientX - dragStart.x);
        setPanY(touch.clientY - dragStart.y);
      } else if (e.touches.length === 2 && touchStart && lastTouchDistance) {
        // Pinch zoom
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const distance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );

        const scale = distance / lastTouchDistance;
        const newZoom = Math.max(0.1, Math.min(10, zoom * scale));

        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          const centerX = touchStart.x - rect.left;
          const centerY = touchStart.y - rect.top;

          const worldX = (centerX - panX) / zoom;
          const worldY = (centerY - panY) / zoom;

          setPanX(centerX - worldX * newZoom);
          setPanY(centerY - worldY * newZoom);
          setZoom(newZoom);
        }

        setLastTouchDistance(distance);
      }
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
      setTouchStart(null);
      setLastTouchDistance(null);
    };

    if (isDragging || touchStart) {
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
      return () => {
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isDragging, dragStart, touchStart, lastTouchDistance, zoom, panX, panY]);

  // Reset zoom and pan
  const resetView = useCallback(() => {
    setZoom(1);
    setPanX(0);
    setPanY(0);
  }, []);

  // Zoom in
  const zoomIn = useCallback(() => {
    setZoom((prev) => Math.min(10, prev * 1.2));
  }, []);

  // Zoom out
  const zoomOut = useCallback(() => {
    setZoom((prev) => Math.max(0.1, prev / 1.2));
  }, []);

  // Render canvas with zoom and pan
  useEffect(() => {
    if (!pattern || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cellSize = baseCellSize;
    const width = pattern.width * cellSize;
    const height = pattern.height * cellSize;

    canvas.width = width;
    canvas.height = height;

    // Clear canvas with appropriate background
    if (settings.colorlessMode) {
      ctx.fillStyle = '#ffffff';
    } else {
      ctx.fillStyle = '#1a1a1a';
    }
    ctx.fillRect(0, 0, width, height);

    // Draw cells with colors (or white in colorless mode)
    for (let y = 0; y < pattern.height; y++) {
      for (let x = 0; x < pattern.width; x++) {
        const cell = pattern.cells[y][x];
        if (settings.colorlessMode) {
          ctx.fillStyle = '#ffffff';
        } else {
          ctx.fillStyle = cell.color.hex;
        }
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }

    // Draw grid lines (always show, but thinner when zoomed out)
    const gridOpacity = Math.min(1, zoom * 0.3);
    if (settings.colorlessMode) {
      ctx.strokeStyle = `rgba(0, 0, 0, ${0.2 * gridOpacity})`;
    } else {
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.15 * gridOpacity})`;
    }
    ctx.lineWidth = 0.5 / zoom;

    for (let x = 0; x <= pattern.width; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cellSize, 0);
      ctx.lineTo(x * cellSize, height);
      ctx.stroke();
    }

    for (let y = 0; y <= pattern.height; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cellSize);
      ctx.lineTo(width, y * cellSize);
      ctx.stroke();
    }

    // Draw symbols (always show, scale with zoom)
    const fontSize = Math.max(6, cellSize * 0.6);
    ctx.font = `${fontSize}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let y = 0; y < pattern.height; y++) {
      for (let x = 0; x < pattern.width; x++) {
        const cell = pattern.cells[y][x];
        // Use adaptive text color based on cell background (or black in colorless mode)
        if (settings.colorlessMode) {
          ctx.fillStyle = '#000000';
        } else {
          ctx.fillStyle = getTextColor(cell.color.hex);
        }
        ctx.fillText(
          cell.symbol,
          x * cellSize + cellSize / 2,
          y * cellSize + cellSize / 2
        );
      }
    }
  }, [pattern, zoom, settings.colorlessMode]);

  // Attach wheel event listener
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => {
        container.removeEventListener('wheel', handleWheel);
      };
    }
  }, [handleWheel]);

  if (!pattern) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center bg-muted/30">
        <Palette className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 text-muted-foreground mb-3 sm:mb-4" />
        <p className="text-sm sm:text-base md:text-lg text-muted-foreground">
          Upload an image and generate a pattern to see the preview
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-muted/30">
      <div className="border-b border-border">
        <div className="flex items-center justify-between p-2 sm:p-2 gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Palette className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
              <h3 className="text-base sm:text-lg font-semibold truncate">Pattern Preview</h3>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">
              {pattern.width} × {pattern.height} stitches •{' '}
              {pattern.palette.length} colors
            </p>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={zoomOut}
              disabled={zoom <= 0.1}
              className="h-8 w-8 sm:h-9 sm:w-auto sm:px-3"
            >
              <ZoomOut className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
            <span className="text-xs sm:text-sm text-muted-foreground min-w-10 sm:min-w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={zoomIn}
              disabled={zoom >= 10}
              className="h-8 w-8 sm:h-9 sm:w-auto sm:px-3"
            >
              <ZoomIn className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={resetView}
              className="h-8 w-8 sm:h-9 sm:w-auto sm:px-3"
            >
              <Maximize2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0 flex flex-col p-4">
        <div
          ref={containerRef}
          className="rounded-lg bg-muted p-2 sm:p-4 overflow-auto flex-1 relative cursor-grab active:cursor-grabbing touch-none"
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        >
          <div
            className="inline-block origin-top-left"
            style={{
              transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
              transformOrigin: '0 0',
            }}
          >
            <canvas ref={canvasRef} className="rounded shadow-sm" />
          </div>
        </div>
      </div>
    </div>
  );
}
