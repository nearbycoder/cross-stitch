import { useEffect, useState } from 'react';
import { usePatternStore } from './store/patternStore';
import { Sidebar } from './components/Sidebar';
import { PatternPreview } from './components/PatternPreview';
import { ColorLegend } from './components/ColorLegend';
import { ResizableSplitPane } from './components/ResizableSplitPane';
import { Alert, AlertDescription } from './components/ui/alert';
import { AlertCircle, Menu, X } from 'lucide-react';
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
    <div className="h-full w-full bg-gradient-to-br from-background via-background to-secondary/20 overflow-hidden flex flex-col">
      <div className="w-full h-full overflow-auto">
        <div className="w-full min-h-full">
          {error && (
            <div className="px-3 sm:px-4 md:px-6 lg:px-8 py-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Error:</strong> {error}
                </AlertDescription>
              </Alert>
            </div>
          )}

          <div className="flex flex-col md:flex-row h-screen relative">
            {/* Mobile sidebar overlay */}
            {sidebarOpen && (
              <div
                className="fixed inset-0 bg-black/50 z-40 md:hidden"
                onClick={() => setSidebarOpen(false)}
              />
            )}
            
            {/* Sidebar */}
            <div
              className={`
                fixed md:static inset-y-0 left-0 z-50 md:z-auto
                transform transition-transform duration-300 ease-in-out
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                w-80 max-w-[85vw] md:w-64 lg:w-80
              `}
            >
              <Sidebar onClose={() => setSidebarOpen(false)} />
            </div>

            {/* Main content */}
            <main className="flex-1 flex flex-col p-1 sm:p-2 md:p-2 overflow-hidden min-h-0 relative">
              {/* Mobile menu button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 left-2 md:hidden z-30 bg-background/80 backdrop-blur-sm"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                {sidebarOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
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
