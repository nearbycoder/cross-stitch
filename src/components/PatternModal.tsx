import { useState, useEffect, useRef, useCallback } from 'react';
import { usePatternStore } from '../store/patternStore';
import { Dialog, DialogContent, DialogTrigger } from './ui/dialog';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Button } from './ui/button';
import { Maximize2, ZoomIn, ZoomOut, X } from 'lucide-react';
import { cn } from '../lib/utils';

// Helper function to calculate luminance of a hex color
function getLuminance(hex: string): number {
  const rgb = hex.match(/^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!rgb) return 0.5;

  const r = parseInt(rgb[1], 16) / 255;
  const g = parseInt(rgb[2], 16) / 255;
  const b = parseInt(rgb[3], 16) / 255;

  const [rLinear, gLinear, bLinear] = [r, g, b].map((val) => {
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

function getTextColor(backgroundColor: string): string {
  const luminance = getLuminance(backgroundColor);
  return luminance > 0.5 ? '#000' : '#fff';
}

export function PatternModal() {
  const { pattern } = usePatternStore();
  const [zoom, setZoom] = useState(0.8);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isOpen, setIsOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const baseCellSize = 20;
  const initialZoom = 0.8; // 80% zoom initially

  // Reset zoom and pan when modal opens
  const resetView = useCallback(() => {
    setZoom(initialZoom);

    // Recalculate center position
    if (containerRef.current && pattern) {
      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      const canvasWidth = pattern.width * baseCellSize * initialZoom;
      const canvasHeight = pattern.height * baseCellSize * initialZoom;

      // Account for container padding (p-4 = 16px)
      const availableWidth = containerRect.width - 32;
      const availableHeight = containerRect.height - 32;

      // Center the canvas
      const centerX = Math.max(0, (availableWidth - canvasWidth) / 2);
      const centerY = Math.max(0, (availableHeight - canvasHeight) / 2);

      setPanX(centerX);
      setPanY(centerY);
    } else {
      setPanX(0);
      setPanY(0);
    }
  }, [pattern]);

  // Reset view when modal opens and center canvas
  useEffect(() => {
    if (!isOpen || !pattern) return;

    // Reset zoom and pan after a microtask to avoid synchronous setState
    Promise.resolve().then(() => {
      setZoom(initialZoom);
      setPanX(0);
      setPanY(0);
    });

    // Center the canvas after container is rendered
    const centerCanvas = () => {
      if (containerRef.current && canvasRef.current) {
        const container = containerRef.current;
        const containerRect = container.getBoundingClientRect();
        const canvasWidth = pattern.width * baseCellSize * initialZoom;
        const canvasHeight = pattern.height * baseCellSize * initialZoom;

        // Account for container padding (p-4 = 16px)
        const availableWidth = containerRect.width - 32;
        const availableHeight = containerRect.height - 32;

        // Center the canvas in the available space
        const centerX = Math.max(0, (availableWidth - canvasWidth) / 2);
        const centerY = Math.max(0, (availableHeight - canvasHeight) / 2);

        setPanX(centerX);
        setPanY(centerY);
      }
    };

    // Try multiple times to ensure container is ready
    setTimeout(centerCanvas, 50);
    setTimeout(centerCanvas, 200);
    setTimeout(centerCanvas, 400);
  }, [isOpen, pattern, initialZoom]);

  const zoomIn = useCallback(() => {
    setZoom((prev) => Math.min(10, prev * 1.2));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((prev) => Math.max(0.1, prev / 1.2));
  }, []);

  // Handle zoom with mouse wheel
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.1, Math.min(10, zoom * delta));

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
        setIsDragging(true);
        setDragStart({ x: e.clientX - panX, y: e.clientY - panY });
      }
    },
    [panX, panY]
  );

  // Handle mouse move for panning
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPanX(e.clientX - dragStart.x);
        setPanY(e.clientY - dragStart.y);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragStart]);

  // Render canvas - re-render when modal opens or pattern changes
  useEffect(() => {
    if (!pattern || !canvasRef.current || !isOpen) {
      return;
    }

    // Small delay to ensure canvas element is ready
    const renderCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const cellSize = baseCellSize;
      const width = pattern.width * cellSize;
      const height = pattern.height * cellSize;

      // Set canvas dimensions
      canvas.width = width;
      canvas.height = height;

      // Clear with dark background
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, width, height);

      // Draw cells with colors
      for (let y = 0; y < pattern.height; y++) {
        for (let x = 0; x < pattern.width; x++) {
          const cell = pattern.cells[y][x];
          ctx.fillStyle = cell.color.hex;
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }
      }

      // Draw grid lines
      const gridOpacity = Math.min(1, zoom * 0.3);
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.15 * gridOpacity})`;
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

      // Draw symbols
      const fontSize = Math.max(6, cellSize * 0.6);
      ctx.font = `${fontSize}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (let y = 0; y < pattern.height; y++) {
        for (let x = 0; x < pattern.width; x++) {
          const cell = pattern.cells[y][x];
          ctx.fillStyle = getTextColor(cell.color.hex);
          ctx.fillText(
            cell.symbol,
            x * cellSize + cellSize / 2,
            y * cellSize + cellSize / 2
          );
        }
      }
    };

    // Use requestAnimationFrame to ensure DOM is ready, then render multiple times
    const rafId = requestAnimationFrame(() => {
      renderCanvas();
    });

    // Also render after delays to ensure visibility after dialog animation
    const timer1 = setTimeout(renderCanvas, 50);
    const timer2 = setTimeout(renderCanvas, 150);
    const timer3 = setTimeout(renderCanvas, 300);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [pattern, zoom, isOpen]);

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

  if (!pattern) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Maximize2 className="mr-2 h-4 w-4" />
          Full Screen View
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[100vw] max-h-[100vh] w-screen h-screen flex flex-col p-0 gap-0 m-0 rounded-none overflow-hidden">
        <div className="flex flex-col h-full min-h-0">
          {/* Color Keys Header */}
          <div className="flex-shrink-0 p-4 border-b border-border bg-background overflow-y-auto">
            <div className="flex items-center mb-3 justify-end">
              <div className="flex items-center gap-2 ">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={zoomOut}
                  disabled={zoom <= 0.1}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground min-w-12 text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={zoomIn}
                  disabled={zoom >= 10}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={resetView}>
                  <Maximize2 className="h-4 w-4" />
                </Button>
                <DialogPrimitive.Close asChild>
                  <Button variant="outline" size="sm">
                    <X className="h-4 w-4" />
                  </Button>
                </DialogPrimitive.Close>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {pattern.palette.map((color, index) => (
                <div
                  key={`${color.code}-${color.symbol}-${index}`}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border bg-background"
                >
                  <div
                    className="w-6 h-6 rounded-md border-2 border-border shadow-sm flex-shrink-0"
                    style={{ backgroundColor: color.hex }}
                  />
                  <div className="flex items-center justify-center w-4 h-4 rounded bg-muted font-bold text-xs flex-shrink-0">
                    {color.symbol}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pattern Canvas - Below Color Keys */}
          <div className="flex-1 min-h-0 p-4 bg-muted/30 overflow-hidden">
            <div
              ref={containerRef}
              className={cn(
                'rounded-lg bg-muted p-4 overflow-auto h-full relative cursor-grab active:cursor-grabbing',
                isDragging && 'cursor-grabbing'
              )}
              onMouseDown={handleMouseDown}
            >
              <div
                className="inline-block origin-top-left"
                style={{
                  transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
                  transformOrigin: '0 0',
                }}
              >
                <canvas
                  ref={canvasRef}
                  className="rounded shadow-sm"
                  key={isOpen ? 'open' : 'closed'}
                />
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
