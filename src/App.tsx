import { useEffect, useState, useRef } from 'react';
import { usePatternStore, setCurrentProjectStorageKey } from './store/patternStore';
import { useProjectStore, getProjectStorageKey } from './store/projectStore';
import { Sidebar } from './components/Sidebar';
import { PatternPreview } from './components/PatternPreview';
import { ColorLegend } from './components/ColorLegend';
import { ResizableSplitPane } from './components/ResizableSplitPane';
import { Menu, X } from 'lucide-react';
import { Button } from './components/ui/button';

// Migration function to convert old single-project data to new format
function migrateOldData() {
  const OLD_STORAGE_KEY = 'cross-stitch-pattern-storage';
  const oldData = localStorage.getItem(OLD_STORAGE_KEY);

  // Check if we already have projects
  const projectsData = localStorage.getItem('cross-stitch-projects');
  if (projectsData) {
    const parsed = JSON.parse(projectsData);
    if (parsed.state?.projects?.length > 0) {
      // Already have projects, no migration needed
      return parsed.state.currentProjectId;
    }
  }

  // If there's old data, migrate it
  if (oldData) {
    try {
      const parsed = JSON.parse(oldData);
      if (parsed.state?.originalImageDataUrl || parsed.state?.settings) {
        // Create a new project for the old data
        const projectId = `project_${Date.now()}_migrated`;
        const newProject = {
          id: projectId,
          name: 'My Pattern',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Save project to project store
        const projectsState = {
          state: {
            projects: [newProject],
            currentProjectId: projectId,
          },
        };
        localStorage.setItem('cross-stitch-projects', JSON.stringify(projectsState));

        // Copy old data to new project-specific storage
        localStorage.setItem(getProjectStorageKey(projectId), oldData);

        // Clean up old storage key
        localStorage.removeItem(OLD_STORAGE_KEY);

        return projectId;
      }
    } catch (e) {
      // Ignore parsing errors
    }
  }

  return null;
}

function App() {
  const {
    originalImage,
    error,
    originalImageDataUrl,
    loadImageFromDataUrl,
    generatePattern,
    pattern,
    _hasHydrated,
    loadProject,
  } = usePatternStore();
  const { currentProjectId, projects, createProject } = useProjectStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const initializedRef = useRef(false);

  // Initialize project system on first load
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    // Try to migrate old data first
    const migratedProjectId = migrateOldData();

    // If migration created a project, use that
    if (migratedProjectId) {
      setCurrentProjectStorageKey(migratedProjectId);
      loadProject(migratedProjectId);
      return;
    }

    // If we have a current project, load it
    if (currentProjectId) {
      setCurrentProjectStorageKey(currentProjectId);
      loadProject(currentProjectId);
      return;
    }

    // If we have no projects at all, create the first one
    if (projects.length === 0) {
      const newId = createProject('My First Pattern');
      setCurrentProjectStorageKey(newId);
      loadProject(newId);
    }
  }, []);

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
