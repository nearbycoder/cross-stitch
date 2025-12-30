import { usePatternStore } from '../store/patternStore';
import { countColorUsage } from '../core/imageProcessing/gridMapper';
import { ScrollArea } from './ui/scroll-area';
import { SwatchBook } from 'lucide-react';
import { PatternModal } from './PatternModal';

export function ColorLegend() {
  const { pattern } = usePatternStore();

  if (!pattern) {
    return null;
  }

  const usage = countColorUsage(pattern.cells);
  const totalStitches = pattern.width * pattern.height;

  return (
    <div className="h-full flex flex-col bg-muted/30">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <SwatchBook className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Color Legend</h3>
          </div>
          <PatternModal />
        </div>
      </div>
      <div className="flex-1 min-h-0 p-4">
        <ScrollArea className="h-full pr-2 sm:pr-4">
          <div className="space-y-2">
            {pattern.palette.map((color, index) => {
              const count = usage.get(color.code) || 0;
              const percentage = ((count / totalStitches) * 100).toFixed(1);

              return (
                <div
                  key={`${color.code}-${color.symbol}-${index}`}
                  className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border bg-background hover:bg-accent/50 transition-colors"
                >
                  <div
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-md border-2 border-border shadow-sm flex-shrink-0"
                    style={{ backgroundColor: color.hex }}
                  />
                  <div className="flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded bg-muted font-bold text-xs sm:text-sm flex-shrink-0">
                    {color.symbol}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-xs sm:text-sm truncate">
                      {color.code} - {color.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {count.toLocaleString()} stitches ({percentage}%)
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
