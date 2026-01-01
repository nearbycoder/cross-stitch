import { useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import type { Project } from '../store/projectStore';
import { usePatternStore } from '../store/patternStore';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import {
  FolderOpen,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  ChevronDown,
} from 'lucide-react';

export function ProjectSelector() {
  const { projects, currentProjectId, createProject, deleteProject, renameProject, switchProject } =
    useProjectStore();
  const { loadProject, originalImageDataUrl, saveToCurrentProject, _currentProjectId } = usePatternStore();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const currentProject = projects.find((p) => p.id === currentProjectId);

  const handleCreateProject = () => {
    // Save current project first
    saveToCurrentProject();
    const newId = createProject();
    loadProject(newId);
    setIsOpen(false);
  };

  const handleSwitchProject = (projectId: string) => {
    if (projectId === currentProjectId) return;
    // Save current project first
    saveToCurrentProject();
    switchProject(projectId);
    loadProject(projectId);
    setIsOpen(false);
  };

  const handleDeleteProject = (projectId: string) => {
    const isCurrentProject = projectId === currentProjectId;
    deleteProject(projectId);

    // If we deleted the current project, load the new current project
    if (isCurrentProject) {
      const { currentProjectId: newCurrentId } = useProjectStore.getState();
      loadProject(newCurrentId);
    }
    setDeleteConfirmId(null);
  };

  const handleStartRename = (project: Project) => {
    setEditingId(project.id);
    setEditName(project.name);
  };

  const handleSaveRename = () => {
    if (editingId && editName.trim()) {
      renameProject(editingId, editName.trim());
    }
    setEditingId(null);
    setEditName('');
  };

  const handleCancelRename = () => {
    setEditingId(null);
    setEditName('');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Count how many projects have saved images
  const projectsWithImages = projects.filter((p) => {
    if (p.id === _currentProjectId) {
      return !!originalImageDataUrl;
    }
    try {
      const data = localStorage.getItem(`cross-stitch-project-${p.id}`);
      if (data) {
        const parsed = JSON.parse(data);
        return !!parsed.state?.originalImageDataUrl;
      }
    } catch {
      // ignore
    }
    return false;
  }).length;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-between border-border/70 bg-card/70 hover:bg-card shadow-sm transition-all"
        >
          <span className="flex items-center gap-2 truncate">
            <FolderOpen className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">
              {currentProject ? currentProject.name : 'No Project'}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 flex-shrink-0 opacity-50" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-card/95 border-border/70 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Your Patterns</DialogTitle>
          <DialogDescription>
            {projects.length === 0
              ? 'Create your first pattern project'
              : `${projects.length} pattern${projects.length === 1 ? '' : 's'}, ${projectsWithImages} with images`}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[300px] pr-4">
          <div className="space-y-2">
            {projects.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No patterns yet</p>
                <p className="text-xs mt-1">Click "New Pattern" to get started</p>
              </div>
            ) : (
              projects.map((project) => (
                <div
                  key={project.id}
                  className={`group relative flex items-center gap-2 p-3 rounded-2xl border transition-all ${
                    project.id === currentProjectId
                      ? 'border-primary/40 bg-primary/10 shadow-sm'
                      : 'border-border/60 bg-card/70 hover:border-primary/40 hover:bg-card cursor-pointer'
                  }`}
                  onClick={() => {
                    if (editingId !== project.id && deleteConfirmId !== project.id) {
                      handleSwitchProject(project.id);
                    }
                  }}
                >
                  {editingId === project.id ? (
                    <div className="flex-1 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-8 text-sm"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveRename();
                          if (e.key === 'Escape') handleCancelRename();
                        }}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={handleSaveRename}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={handleCancelRename}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : deleteConfirmId === project.id ? (
                    <div className="flex-1 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                      <span className="text-sm text-destructive">Delete this pattern?</span>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleDeleteProject(project.id)}
                        >
                          Delete
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => setDeleteConfirmId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{project.name}</span>
                          {project.id === currentProjectId && (
                            <span className="text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-full font-semibold">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Updated {formatDate(project.updatedAt)}
                        </p>
                      </div>
                      <div
                        className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => handleStartRename(project)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteConfirmId(project.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button onClick={handleCreateProject} className="w-full rounded-xl bg-gradient-to-r from-primary via-primary/90 to-[hsl(var(--chart-4))]">
            <Plus className="h-4 w-4 mr-2" />
            New Pattern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
