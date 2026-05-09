import { create } from 'zustand'
import type { Project, FileNode, EditorTab, SearchResult } from '../../shared/types'

interface ProjectState {
  // Project management
  projects: Project[]
  activeProjectId: string | null
  setProjects: (projects: Project[]) => void
  addProject: (project: Project) => void
  removeProject: (id: string) => void
  setActiveProject: (id: string | null) => void

  // File tree
  fileTree: Record<string, FileNode[]>
  expandedDirs: Set<string>
  setFileTree: (projectPath: string, nodes: FileNode[]) => void
  toggleDir: (path: string) => void
  setExpandedDirs: (dirs: Set<string>) => void
  updateNodeChildren: (parentPath: string, children: FileNode[], projectPath: string) => void

  // Editor
  openTabs: EditorTab[]
  activeTabId: string | null
  openFileTab: (tab: EditorTab) => void
  closeFileTab: (id: string) => void
  setActiveTab: (id: string | null) => void
  updateTabContent: (id: string, content: string) => void
  markTabSaved: (id: string) => void

  // Global search
  searchResults: SearchResult[]
  searchQuery: string
  isSearchOpen: boolean
  setSearchResults: (results: SearchResult[]) => void
  setSearchQuery: (query: string) => void
  toggleSearch: () => void
  setSearchOpen: (open: boolean) => void

  // Gitignore
  ignoredPatterns: Record<string, string>
  setIgnoredPatterns: (projectPath: string, patterns: string) => void
}

export const useProjectStore = create<ProjectState>((set) => ({
  // Project management
  projects: [],
  activeProjectId: null,
  setProjects: (projects) => set({ projects }),
  addProject: (project) =>
    set((state) => {
      if (state.projects.find((p) => p.path === project.path)) return state
      return { projects: [...state.projects, project] }
    }),
  removeProject: (id) =>
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      activeProjectId: state.activeProjectId === id
        ? (state.projects.find((p) => p.id !== id)?.id ?? null)
        : state.activeProjectId
    })),
  setActiveProject: (id) => set({ activeProjectId: id }),

  // File tree
  fileTree: {},
  expandedDirs: new Set(),
  setFileTree: (projectPath, nodes) =>
    set((state) => ({
      fileTree: { ...state.fileTree, [projectPath]: nodes }
    })),
  toggleDir: (path) =>
    set((state) => {
      const next = new Set(state.expandedDirs)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return { expandedDirs: next }
    }),
  setExpandedDirs: (dirs) => set({ expandedDirs: dirs }),
  updateNodeChildren: (parentPath, children, projectPath) =>
    set((state) => {
      const rootNodes = state.fileTree[projectPath]
      if (!rootNodes) return state

      function update(nodes: FileNode[]): FileNode[] {
        return nodes.map((node) => {
          if (node.path === parentPath) {
            return { ...node, children, loading: false, expanded: true }
          }
          if (node.children) {
            return { ...node, children: update(node.children) }
          }
          return node
        })
      }

      return {
        fileTree: { ...state.fileTree, [projectPath]: update(rootNodes) }
      }
    }),

  // Editor
  openTabs: [],
  activeTabId: null,
  openFileTab: (tab) =>
    set((state) => {
      const exists = state.openTabs.find((t) => t.id === tab.id)
      if (exists) return { activeTabId: tab.id }
      return {
        openTabs: [...state.openTabs, tab],
        activeTabId: tab.id
      }
    }),
  closeFileTab: (id) =>
    set((state) => {
      const tabs = state.openTabs.filter((t) => t.id !== id)
      const activeTabId =
        state.activeTabId === id
          ? tabs.length > 0
            ? tabs[tabs.length - 1].id
            : null
          : state.activeTabId
      return { openTabs: tabs, activeTabId }
    }),
  setActiveTab: (id) => set({ activeTabId: id }),
  updateTabContent: (id, content) =>
    set((state) => ({
      openTabs: state.openTabs.map((t) =>
        t.id === id ? { ...t, content, isDirty: content !== t.originalContent } : t
      )
    })),
  markTabSaved: (id) =>
    set((state) => ({
      openTabs: state.openTabs.map((t) =>
        t.id === id ? { ...t, originalContent: t.content, isDirty: false } : t
      )
    })),

  // Global search
  searchResults: [],
  searchQuery: '',
  isSearchOpen: false,
  setSearchResults: (results) => set({ searchResults: results }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  toggleSearch: () => set((state) => ({ isSearchOpen: !state.isSearchOpen })),
  setSearchOpen: (open) => set({ isSearchOpen: open }),

  // Gitignore
  ignoredPatterns: {},
  setIgnoredPatterns: (projectPath, patterns) =>
    set((state) => ({
      ignoredPatterns: { ...state.ignoredPatterns, [projectPath]: patterns }
    }))
}))
