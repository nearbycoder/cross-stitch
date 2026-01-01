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
    <div className="h-full flex flex-col rounded-2xl border border-border/70 bg-card/70 shadow-sm overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-border/60 bg-card/80 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-primary/15 ring-1 ring-primary/20">
              <SwatchBook className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-semibold tracking-tight font-display">Color Legend</h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                  {pattern.palette.length} colors
                </span>
                <span>{totalStitches.toLocaleString()} stitches</span>
              </div>
            </div>
          </div>
          <PatternModal />
        </div>
      </div>
      <div className="flex-1 min-h-0 p-4 sm:p-5">
        <ScrollArea className="h-full pr-2 sm:pr-4">
          <div className="space-y-2">
            {pattern.palette.map((color, index) => {
              const count = usage.get(color.code) || 0;
              const percentage = ((count / totalStitches) * 100).toFixed(1);

              return (
                <div
                  key={`${color.code}-${color.symbol}-${index}`}
                  className="group flex items-center gap-3 p-3 rounded-2xl border border-border/60 bg-card/70 hover:bg-card shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
                >
                  <div
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl border-2 border-border/60 shadow-md group-hover:shadow-lg group-hover:scale-105 transition-all duration-200 flex-shrink-0 ring-2 ring-transparent group-hover:ring-primary/20"
                    style={{ backgroundColor: color.hex }}
                  />
                  <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-muted/80 group-hover:bg-muted font-bold text-sm sm:text-base flex-shrink-0 shadow-sm group-hover:shadow transition-all duration-200">
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
