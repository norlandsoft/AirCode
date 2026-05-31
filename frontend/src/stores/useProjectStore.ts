import { create } from "zustand"
import type { Project, FileEntry } from "@/lib/types"
import { api } from "@/lib/api"

interface ProjectState {
  projects: Project[]
  activeProjectId: string | null
  fileTree: FileEntry[]

  addProject: (path: string) => Promise<void>
  removeProject: (id: string) => void
  setActiveProject: (id: string) => void
  loadFileTree: (dirPath: string) => Promise<void>
  loadFromStorage: () => void
  saveToStorage: () => void
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

    get().saveToStorage()

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
    get().saveToStorage()
  },

  setActiveProject: (id: string) => {
    set({ activeProjectId: id })
    const project = get().projects.find((p) => p.id === id)
    if (project) {
      get().loadFileTree(project.path)
    }
    get().saveToStorage()
  },

  loadFileTree: async (dirPath: string) => {
    const a = await api()
    const result = await a.project.list_directory(dirPath)
    if (result.error) return
    set({ fileTree: (result.entries as FileEntry[]) || [] })
  },

  loadFromStorage: () => {
    try {
      const data = localStorage.getItem("aircode_projects")
      if (data) {
        const parsed = JSON.parse(data)
        set({
          projects: parsed.projects || [],
          activeProjectId: parsed.activeProjectId || null,
        })
      }
    } catch {
      // Ignore parse errors
    }
  },

  saveToStorage: () => {
    const { projects, activeProjectId } = get()
    localStorage.setItem(
      "aircode_projects",
      JSON.stringify({ projects, activeProjectId })
    )
  },
}))
