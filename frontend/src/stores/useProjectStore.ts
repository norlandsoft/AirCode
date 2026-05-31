import { create } from "zustand"
import type { Project, FileEntry } from "@/lib/types"
import { api } from "@/lib/api"
import { useSettingsStore } from "./useSettingsStore"

interface ProjectState {
  projects: Project[]
  activeProjectId: string | null
  fileTree: FileEntry[]

  addProject: (path: string) => Promise<void>
  removeProject: (id: string) => void
  renameProject: (id: string, name: string) => void
  setActiveProject: (id: string) => void
  loadFileTree: (dirPath: string) => Promise<void>
  loadFromStorage: () => Promise<void>
  _saveToBackend: () => Promise<void>
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  activeProjectId: null,
  fileTree: [],

  addProject: async (path: string) => {
    const a = await api()
    const result = await a.project.get_project_info(path)
    if (result.error) return

    const project: Project = {
      id: path,
      name: (result.name as string) || path.split("/").pop() || path,
      path: path,
      isGitRepo: (result.is_git_repo as boolean) || false,
    }

    const exists = get().projects.some((p) => p.path === path)
    if (exists) return

    set((state) => ({
      projects: [...state.projects, project],
      activeProjectId: state.activeProjectId || project.id,
    }))

    await get()._saveToBackend()

    if (get().activeProjectId === project.id) {
      get().loadFileTree(path)
    }
  },

  removeProject: (id: string) => {
    set((state) => {
      const projects = state.projects.filter((p) => p.id !== id)
      const activeProjectId =
        state.activeProjectId === id
          ? projects[0]?.id || null
          : state.activeProjectId
      return { projects, activeProjectId }
    })
    get()._saveToBackend()
  },

  renameProject: (id: string, name: string) => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, name } : p
      ),
    }))
    get()._saveToBackend()
  },

  setActiveProject: (id: string) => {
    set({ activeProjectId: id })
    const project = get().projects.find((p) => p.id === id)
    if (project) {
      get().loadFileTree(project.path)
    }
    get()._saveToBackend()
  },

  loadFileTree: async (dirPath: string) => {
    const a = await api()
    const result = await a.project.list_directory(dirPath)
    if (result.error) return
    set({ fileTree: (result.entries as FileEntry[]) || [] })
  },

  loadFromStorage: async () => {
    // Load global settings (which includes recentProjects)
    await useSettingsStore.getState().loadSettings()

    // One-time migration from legacy localStorage
    const legacyData = localStorage.getItem("aircode_projects")
    if (legacyData) {
      try {
        const parsed = JSON.parse(legacyData)
        if (parsed.projects && Array.isArray(parsed.projects)) {
          // Import legacy projects into backend
          const settings = useSettingsStore.getState().settings
          const existingPaths = new Set(settings.recentProjects)
          const newPaths = parsed.projects
            .map((p: { path: string }) => p.path)
            .filter((p: string) => !existingPaths.has(p))
          if (newPaths.length > 0 || parsed.activeProjectId) {
            await useSettingsStore.getState().updateSettings({
              recentProjects: [...settings.recentProjects, ...newPaths],
            })
          }
          // Restore project objects from legacy data
          set({
            projects: parsed.projects || [],
            activeProjectId: parsed.activeProjectId || null,
          })
          // Clear legacy data
          localStorage.removeItem("aircode_projects")
          return
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Normal load from backend
    const settings = useSettingsStore.getState().settings
    const recentPaths = settings.recentProjects || []
    if (recentPaths.length === 0) return

    const a = await api()
    const projects: Project[] = []
    for (const projPath of recentPaths) {
      const info = await a.project.get_project_info(projPath)
      if (info.error || !info.exists) continue
      projects.push({
        id: projPath,
        name: (info.name as string) || projPath.split("/").pop() || projPath,
        path: projPath,
        isGitRepo: (info.is_git_repo as boolean) || false,
      })
    }
    set({
      projects,
      activeProjectId: projects[0]?.id || null,
    })
  },

  _saveToBackend: async () => {
    const { projects, activeProjectId } = get()
    const recentProjects = projects.map((p) => p.path)
    await useSettingsStore.getState().updateSettings({
      recentProjects,
    } as Partial<import("@/lib/types").AppSettings>)
    // Also save active project as the first in list for convenience
    if (activeProjectId) {
      const reordered = [
        activeProjectId,
        ...recentProjects.filter((p) => p !== activeProjectId),
      ]
      await useSettingsStore.getState().updateSettings({
        recentProjects: reordered,
      } as Partial<import("@/lib/types").AppSettings>)
    }
  },
}))
