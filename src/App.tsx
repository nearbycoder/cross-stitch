import { useEffect, useState } from 'react';
import { usePatternStore } from './store/patternStore';
import { Sidebar } from './components/Sidebar';
import { PatternPreview } from './components/PatternPreview';
import { ColorLegend } from './components/ColorLegend';
import { ResizableSplitPane } from './components/ResizableSplitPane';
import { Menu, X } from 'lucide-react';
import { Button } from './components/ui/button';

function App() {
  const {
    originalImage,
    error,
    originalImageDataUrl,
    loadImageFromDataUrl,
    generatePattern,
    pattern,
    _hasHydrated,
  } = usePatternStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Restore image from localStorage after hydration
  useEffect(() => {
    if (_hasHydrated && originalImageDataUrl && !originalImage) {
      loadImageFromDataUrl(originalImageDataUrl).catch(() => {
        // Silently handle error
      });
    }
  }, [_hasHydrated, originalImageDataUrl, originalImage, loadImageFromDataUrl]);

  // Auto-regenerate pattern if image exists but pattern doesn't (after hydration)
  useEffect(() => {
    if (_hasHydrated && originalImage && !pattern && !error) {
      // Small delay to ensure everything is ready
      const timer = setTimeout(() => {
        generatePattern();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [_hasHydrated, originalImage, pattern, error, generatePattern]);

  return (
    <div className="h-full w-full bg-gradient-to-br from-background via-background to-muted/30 overflow-hidden flex flex-col">
      <div className="w-full h-full overflow-auto">
        <div className="w-full min-h-full">
          <div className="flex flex-col md:flex-row h-screen relative">
            {/* Mobile sidebar overlay */}
            {sidebarOpen && (
              <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-200"
                onClick={() => setSidebarOpen(false)}
              />
            )}

            {/* Sidebar */}
            <div
              className={`
                fixed md:static inset-y-0 left-0 z-50 md:z-auto
                transform transition-transform duration-300 ease-out
                ${
                  sidebarOpen
                    ? 'translate-x-0'
                    : '-translate-x-full md:translate-x-0'
                }
                w-80 max-w-[85vw] md:w-64 lg:w-80
              `}
              style={{
                backgroundColor: 'hsl(var(--background))',
                opacity: 1,
              }}
            >
              <Sidebar onClose={() => setSidebarOpen(false)} />
            </div>

            {/* Main content */}
            <main className="flex-1 flex flex-col p-2 sm:p-3 md:p-4 overflow-hidden min-h-0 relative">
              {/* Mobile menu button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-3 left-3 md:hidden z-30 bg-background/95 backdrop-blur-md border border-border/50 shadow-lg hover:bg-background hover:shadow-xl transition-all duration-200"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                {sidebarOpen ? (
                  <X className="h-5 w-5 transition-transform duration-200" />
                ) : (
                  <Menu className="h-5 w-5 transition-transform duration-200" />
                )}
              </Button>

              <ResizableSplitPane
                topChild={<PatternPreview />}
                bottomChild={<ColorLegend />}
                storageKey="pattern-split-position"
                defaultSplit={50}
              />
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
