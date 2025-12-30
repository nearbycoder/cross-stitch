import { useEffect } from 'react';
import { usePatternStore } from './store/patternStore';
import { Sidebar } from './components/Sidebar';
import { PatternPreview } from './components/PatternPreview';
import { ColorLegend } from './components/ColorLegend';
import { ResizableSplitPane } from './components/ResizableSplitPane';
import { Alert, AlertDescription } from './components/ui/alert';
import { AlertCircle } from 'lucide-react';

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

          <div className="flex flex-col md:flex-row h-screen">
            <Sidebar />
            <main className="flex-1 flex flex-col p-1 sm:p-2 overflow-hidden min-h-0">
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
