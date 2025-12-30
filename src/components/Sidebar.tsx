import { usePatternStore } from '../store/patternStore';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Slider } from './ui/slider';
import { Checkbox } from './ui/checkbox';
import { Sparkles, Loader2, X, Upload } from 'lucide-react';
import { ImageUploader } from './ImageUploader';
import { ProjectSelector } from './ProjectSelector';
import { useState, useEffect } from 'react';

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const { settings, updateSettings, generatePattern, isProcessing, originalImage, pattern, reset } = usePatternStore();
  const [gridWidthInput, setGridWidthInput] = useState<string>(settings.gridWidth.toString());
  const [gridHeightInput, setGridHeightInput] = useState<string>(settings.gridHeight.toString());

  // Sync local state with settings when settings change externally
  useEffect(() => {
    setGridWidthInput(settings.gridWidth.toString());
    setGridHeightInput(settings.gridHeight.toString());
  }, [settings.gridWidth, settings.gridHeight]);

  const handleGridWidthChange = (value: string) => {
    setGridWidthInput(value);
    const numValue = parseInt(value);
    if (!isNaN(numValue) && numValue >= 10 && numValue <= 500) {
      updateSettings({ gridWidth: numValue });
    }
  };

  const handleGridHeightChange = (value: string) => {
    setGridHeightInput(value);
    const numValue = parseInt(value);
    if (!isNaN(numValue) && numValue >= 10 && numValue <= 500) {
      updateSettings({ gridHeight: numValue });
    }
  };

  return (
    <aside 
      className="w-full h-full border-r border-border/50 flex flex-col overflow-hidden shadow-xl md:shadow-lg" 
      style={{ 
        backgroundColor: 'hsl(var(--background))',
        opacity: 1,
      }}
    >
      <div
        className="flex-shrink-0 p-4 sm:p-5 border-b border-border/50 bg-gradient-to-r from-background to-muted/20"
        style={{
          backgroundColor: 'hsl(var(--background))',
          opacity: 1,
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-semibold tracking-tight">Cross Stitch</h2>
              {originalImage && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {pattern ? `${pattern.width} × ${pattern.height}` : 'Ready'}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="h-8 w-8 md:hidden hover:bg-destructive/10 hover:text-destructive transition-colors"
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
                className="h-8 w-8 hidden md:flex hover:bg-destructive/10 hover:text-destructive transition-colors"
                title="Reset and upload new image"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <ProjectSelector />
      </div>

      <div 
        className="flex-1 min-h-0 p-4 sm:p-5 space-y-6 overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent" 
        style={{ 
          backgroundColor: 'hsl(var(--background))',
          opacity: 1,
        }}
      >
        {!originalImage ? (
          <div className="py-8 sm:py-12">
            <ImageUploader />
          </div>
        ) : (
          <>
            <div className="space-y-3 p-4 rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <Label htmlFor="maxColors" className="text-sm font-medium">Max Colors</Label>
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
                  className="w-16 h-9 text-center text-sm font-semibold border-2 focus:border-primary transition-colors"
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
              <div className="flex justify-between text-xs text-muted-foreground px-1 font-medium">
                <span>2</span>
                <span>50</span>
              </div>
            </div>

            <div className="space-y-4 p-4 rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm">
              <div className="space-y-2">
                <Label htmlFor="gridWidth" className="text-sm font-medium">Grid Width (stitches)</Label>
                <Input
                  id="gridWidth"
                  type="number"
                  min="10"
                  max="500"
                  value={gridWidthInput}
                  onChange={(e) => handleGridWidthChange(e.target.value)}
                  onBlur={(e) => {
                    const numValue = parseInt(e.target.value);
                    if (isNaN(numValue) || numValue < 10 || numValue > 500) {
                      setGridWidthInput(settings.gridWidth.toString());
                    }
                  }}
                  placeholder="100"
                  disabled={isProcessing}
                  className="w-full border-2 focus:border-primary transition-colors"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gridHeight" className="text-sm font-medium">Grid Height (stitches)</Label>
                <Input
                  id="gridHeight"
                  type="number"
                  min="10"
                  max="500"
                  value={gridHeightInput}
                  onChange={(e) => handleGridHeightChange(e.target.value)}
                  onBlur={(e) => {
                    const numValue = parseInt(e.target.value);
                    if (isNaN(numValue) || numValue < 10 || numValue > 500) {
                      setGridHeightInput(settings.gridHeight.toString());
                    }
                  }}
                  placeholder="100"
                  disabled={isProcessing}
                  className="w-full border-2 focus:border-primary transition-colors"
                />
              </div>
            </div>

            <div className="space-y-2.5 p-4 rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm">
              <div className="flex items-center space-x-3 group cursor-pointer">
                <Checkbox
                  id="maintainAspectRatio"
                  checked={settings.maintainAspectRatio}
                  onCheckedChange={(checked: boolean) => updateSettings({ maintainAspectRatio: !!checked })}
                  disabled={isProcessing}
                  className="group-hover:ring-2 group-hover:ring-primary/20 transition-all"
                />
                <Label
                  htmlFor="maintainAspectRatio"
                  className="text-sm font-normal cursor-pointer group-hover:text-foreground transition-colors"
                >
                  Maintain aspect ratio
                </Label>
              </div>
              <div className="flex items-center space-x-3 group cursor-pointer">
                <Checkbox
                  id="colorlessMode"
                  checked={settings.colorlessMode}
                  onCheckedChange={(checked: boolean) => updateSettings({ colorlessMode: !!checked })}
                  disabled={isProcessing}
                  className="group-hover:ring-2 group-hover:ring-primary/20 transition-all"
                />
                <Label
                  htmlFor="colorlessMode"
                  className="text-sm font-normal cursor-pointer group-hover:text-foreground transition-colors"
                >
                  Colorless mode
                </Label>
              </div>
            </div>

            <div className="space-y-2.5">
              <Button
                className="w-full h-11 text-base font-semibold shadow-md hover:shadow-lg transition-all duration-200 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary"
                onClick={() => {
                  if (!isProcessing && originalImage) {
                    generatePattern().catch((err) => {
                      console.error('Error generating pattern:', err);
                    });
                  }
                }}
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
                className="w-full border-2 hover:bg-accent/50 transition-all duration-200"
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
