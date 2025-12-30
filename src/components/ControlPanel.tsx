import { usePatternStore } from '../store/patternStore';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Slider } from './ui/slider';
import { Checkbox } from './ui/checkbox';
import { Sparkles } from 'lucide-react';

export function ControlPanel() {
  const {
    settings,
    updateSettings,
    generatePattern,
    isProcessing,
    originalImage,
    pattern,
  } = usePatternStore();

  return (
    <Card>
      <CardHeader className="p-1 sm:p-2">
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
          <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          Pattern Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 sm:space-y-5 md:space-y-6 p-1 sm:p-2 pt-0">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="maxColors" className="text-sm sm:text-base">
              Max Colors
            </Label>
            <div className="flex items-center gap-2">
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="gridWidth" className="text-sm sm:text-base">
              Grid Width (stitches)
            </Label>
            <Input
              id="gridWidth"
              type="number"
              min="10"
              max="500"
              value={settings.gridWidth}
              onChange={(e) =>
                updateSettings({ gridWidth: parseInt(e.target.value) || 10 })
              }
              disabled={isProcessing}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gridHeight" className="text-sm sm:text-base">
              Grid Height (stitches)
            </Label>
            <Input
              id="gridHeight"
              type="number"
              min="10"
              max="500"
              value={settings.gridHeight}
              onChange={(e) =>
                updateSettings({ gridHeight: parseInt(e.target.value) || 10 })
              }
              disabled={isProcessing}
              className="w-full"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="maintainAspectRatio"
            checked={settings.maintainAspectRatio}
            onCheckedChange={(checked) =>
              updateSettings({ maintainAspectRatio: !!checked })
            }
            disabled={isProcessing}
          />
          <Label
            htmlFor="maintainAspectRatio"
            className="text-sm sm:text-base font-normal cursor-pointer"
          >
            Maintain aspect ratio
          </Label>
        </div>

        <Button
          className="w-full"
          onClick={generatePattern}
          disabled={!originalImage || isProcessing}
          size="lg"
        >
          {isProcessing ? (
            <>
              <span className="animate-pulse mr-2">⏳</span>
              Processing...
            </>
          ) : pattern ? (
            'Regenerate Pattern'
          ) : (
            'Generate Pattern'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
