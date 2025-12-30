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
    <div className="h-full flex flex-col bg-muted/20">
      <div className="p-3 sm:p-4 border-b border-border/50 bg-gradient-to-r from-background to-muted/20">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <SwatchBook className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold tracking-tight">Color Legend</h3>
          </div>
          <PatternModal />
        </div>
      </div>
      <div className="flex-1 min-h-0 p-3 sm:p-4">
        <ScrollArea className="h-full pr-2 sm:pr-4">
          <div className="space-y-2">
            {pattern.palette.map((color, index) => {
              const count = usage.get(color.code) || 0;
              const percentage = ((count / totalStitches) * 100).toFixed(1);

              return (
                <div
                  key={`${color.code}-${color.symbol}-${index}`}
                  className="group flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm hover:bg-card hover:border-border hover:shadow-md transition-all duration-200 cursor-pointer"
                >
                  <div
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg border-2 border-border/50 shadow-md group-hover:shadow-lg group-hover:scale-105 transition-all duration-200 flex-shrink-0 ring-2 ring-transparent group-hover:ring-primary/20"
                    style={{ backgroundColor: color.hex }}
                  />
                  <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-muted/80 group-hover:bg-muted font-bold text-sm sm:text-base flex-shrink-0 shadow-sm group-hover:shadow transition-all duration-200">
                    {color.symbol}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm sm:text-base truncate group-hover:text-primary transition-colors">
                      {color.code} - {color.name}
                    </div>
                    <div className="text-xs sm:text-sm text-muted-foreground mt-0.5">
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
