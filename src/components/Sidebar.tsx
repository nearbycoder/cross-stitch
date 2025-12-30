import { useEffect, useRef } from 'react';
import { usePatternStore } from '../store/patternStore';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Slider } from './ui/slider';
import { Checkbox } from './ui/checkbox';
import { Sparkles, Loader2, X, Upload } from 'lucide-react';
import { ImageUploader } from './ImageUploader';

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const { settings, updateSettings, generatePattern, isProcessing, originalImage, pattern, _hasHydrated, reset } = usePatternStore();
  const regenerateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialMountRef = useRef(true);

  // Skip auto-regeneration on initial mount (when restoring from localStorage)
  useEffect(() => {
    if (_hasHydrated) {
      // Wait a bit for everything to settle, then allow auto-regeneration
      const timer = setTimeout(() => {
        isInitialMountRef.current = false;
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [_hasHydrated]);

  // Auto-regenerate pattern when grid dimensions change (debounced)
  useEffect(() => {
    // Don't auto-regenerate on initial mount or if not hydrated yet
    if (isInitialMountRef.current || !_hasHydrated) {
      return;
    }

    if (pattern && originalImage && !isProcessing) {
      // Only regenerate if dimensions actually changed
      const dimensionsChanged = pattern.width !== settings.gridWidth || pattern.height !== settings.gridHeight;
      
      if (dimensionsChanged) {
        // Clear existing timeout
        if (regenerateTimeoutRef.current) {
          clearTimeout(regenerateTimeoutRef.current);
        }

        // Set new timeout to regenerate after user stops typing (500ms delay)
        regenerateTimeoutRef.current = setTimeout(() => {
          generatePattern();
        }, 500);
      }

      return () => {
        if (regenerateTimeoutRef.current) {
          clearTimeout(regenerateTimeoutRef.current);
        }
      };
    }
  }, [settings.gridWidth, settings.gridHeight, pattern?.width, pattern?.height, originalImage, isProcessing, generatePattern, _hasHydrated]);

  const handleGridWidthChange = (value: number) => {
    updateSettings({ gridWidth: value });
  };

  const handleGridHeightChange = (value: number) => {
    updateSettings({ gridHeight: value });
  };

  return (
    <aside className="w-full h-full border-r border-border bg-background flex flex-col overflow-hidden shadow-lg md:shadow-none">
      <div className="flex-shrink-0 p-3 sm:p-4 border-b border-border">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-base sm:text-lg font-semibold">Pattern Settings</h2>
          </div>
          <div className="flex items-center gap-1">
            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8 md:hidden"
                title="Close sidebar"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            {originalImage && (
              <Button
                variant="ghost"
                size="icon"
                onClick={reset}
                disabled={isProcessing}
                className="h-8 w-8"
                title="Reset and upload new image"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 p-4 space-y-6 overflow-y-auto">
        {!originalImage ? (
          <div className="py-8">
            <ImageUploader />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="maxColors" className="text-sm">Max Colors</Label>
                <Input
                  id="maxColors-input"
                  type="number"
                  min="2"
                  max="50"
                  value={settings.maxColors}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    if (!isNaN(value) && value >= 2 && value <= 50) {
                      updateSettings({ maxColors: value });
                    }
                  }}
                  disabled={isProcessing}
                  className="w-16 h-8 text-center text-sm"
                />
              </div>
              <Slider
                id="maxColors"
                min={2}
                max={50}
                step={1}
                value={[settings.maxColors]}
                onValueChange={(value) => updateSettings({ maxColors: value[0] })}
                disabled={isProcessing}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground px-1">
                <span>2</span>
                <span>50</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="gridWidth" className="text-sm">Grid Width (stitches)</Label>
                <Input
                  id="gridWidth"
                  type="number"
                  min="10"
                  max="500"
                  value={settings.gridWidth}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 10;
                    handleGridWidthChange(value);
                  }}
                  disabled={isProcessing}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gridHeight" className="text-sm">Grid Height (stitches)</Label>
                <Input
                  id="gridHeight"
                  type="number"
                  min="10"
                  max="500"
                  value={settings.gridHeight}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 10;
                    handleGridHeightChange(value);
                  }}
                  disabled={isProcessing}
                  className="w-full"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="maintainAspectRatio"
                  checked={settings.maintainAspectRatio}
                  onCheckedChange={(checked: boolean) => updateSettings({ maintainAspectRatio: !!checked })}
                  disabled={isProcessing}
                />
                <Label
                  htmlFor="maintainAspectRatio"
                  className="text-sm font-normal cursor-pointer"
                >
                  Maintain aspect ratio
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="colorlessMode"
                  checked={settings.colorlessMode}
                  onCheckedChange={(checked: boolean) => updateSettings({ colorlessMode: !!checked })}
                  disabled={isProcessing}
                />
                <Label
                  htmlFor="colorlessMode"
                  className="text-sm font-normal cursor-pointer"
                >
                  Colorless mode
                </Label>
              </div>
            </div>

            <div className="space-y-2">
              <Button
                className="w-full"
                onClick={generatePattern}
                disabled={!originalImage || isProcessing}
                size="lg"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : pattern ? (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Regenerate Pattern
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Pattern
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={reset}
                disabled={isProcessing}
                size="sm"
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload New Image
              </Button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
