import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface ProjectStore {
  // State
  projects: Project[];
  currentProjectId: string | null;

  // Actions
  createProject: (name?: string) => string;
  deleteProject: (id: string) => void;
  renameProject: (id: string, name: string) => void;
  switchProject: (id: string) => void;
  getCurrentProject: () => Project | null;
  updateProjectTimestamp: (id: string) => void;
}

function generateId(): string {
  return `project_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function getDefaultProjectName(projectNumber: number): string {
  return `Pattern ${projectNumber}`;
}

// Storage key prefix for project-specific data
export function getProjectStorageKey(projectId: string): string {
  return `cross-stitch-project-${projectId}`;
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      projects: [],
      currentProjectId: null,

      createProject: (name?: string) => {
        const { projects } = get();
        const id = generateId();
        const projectNumber = projects.length + 1;
        const newProject: Project = {
          id,
          name: name || getDefaultProjectName(projectNumber),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        set({
          projects: [...projects, newProject],
          currentProjectId: id,
        });

        return id;
      },

      deleteProject: (id: string) => {
        const { projects, currentProjectId } = get();

        // Remove the project from the list
        const newProjects = projects.filter(p => p.id !== id);

        // Clean up project-specific localStorage
        localStorage.removeItem(getProjectStorageKey(id));

        // If we're deleting the current project, switch to another one
        let newCurrentId = currentProjectId;
        if (currentProjectId === id) {
          newCurrentId = newProjects.length > 0 ? newProjects[0].id : null;
        }

        set({
          projects: newProjects,
          currentProjectId: newCurrentId,
        });
      },

      renameProject: (id: string, name: string) => {
        const { projects } = get();
        const updatedProjects = projects.map(p =>
          p.id === id
            ? { ...p, name, updatedAt: new Date().toISOString() }
            : p
        );
        set({ projects: updatedProjects });
      },

      switchProject: (id: string) => {
        const { projects } = get();
        const project = projects.find(p => p.id === id);
        if (project) {
          set({ currentProjectId: id });
        }
      },

      getCurrentProject: () => {
        const { projects, currentProjectId } = get();
        return projects.find(p => p.id === currentProjectId) || null;
      },

      updateProjectTimestamp: (id: string) => {
        const { projects } = get();
        const updatedProjects = projects.map(p =>
          p.id === id
            ? { ...p, updatedAt: new Date().toISOString() }
            : p
        );
        set({ projects: updatedProjects });
      },
    }),
    {
      name: 'cross-stitch-projects',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
