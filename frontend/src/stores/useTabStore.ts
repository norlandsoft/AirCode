import { create } from "zustand"
import type { Tab, TabType } from "@/lib/types"
import { useTerminalStore } from "@/stores/useTerminalStore"

interface TabState {
  tabs: Tab[]
  activeTabId: string | null

  addTab: (type: TabType, projectId: string, extra?: Partial<Tab>) => string
  removeTab: (id: string) => void
  setActiveTab: (id: string) => void
  updateTab: (id: string, updates: Partial<Tab>) => void
  getActiveTab: () => Tab | undefined
  getRestorableTabs: () => Tab[]
  ensureGitTab: (projectId: string) => void
  getProjectTabs: (projectId: string) => Tab[]
}

const TAB_ICONS: Record<TabType, string> = {
  terminal: "🖥️",
  code: "📝",
  git: "🔀",
}

const TAB_TITLES: Record<TabType, string> = {
  terminal: "终端",
  code: "代码",
  git: "Git",
}

let tabCounter = 0

export const useTabStore = create<TabState>((set, get) => ({
  tabs: [],
  activeTabId: null,

  addTab: (type: TabType, projectId: string, extra?: Partial<Tab>) => {
    tabCounter++
    const id = `${type}_${tabCounter}_${Date.now()}`
    const tab: Tab = {
      id,
      type,
      title: extra?.title || TAB_TITLES[type],
      icon: TAB_ICONS[type],
      projectId,
      ...extra,
    }

    set((state) => {
      // Insert non-git tabs before the git tab; git tabs go to the end
      let newTabs: Tab[]
      if (type === "git") {
        newTabs = [...state.tabs, tab]
      } else {
        const gitIndex = state.tabs.findIndex((t) => t.type === "git")
        if (gitIndex >= 0) {
          newTabs = [
            ...state.tabs.slice(0, gitIndex),
            tab,
            ...state.tabs.slice(gitIndex),
          ]
        } else {
          newTabs = [...state.tabs, tab]
        }
      }
      return { tabs: newTabs, activeTabId: id }
    })

    return id
  },

  removeTab: (id: string) => {
    const state = get()
    const tab = state.tabs.find((t) => t.id === id)
    // Git tab cannot be closed
    if (tab?.type === "git") return
    // Destroy terminal PTY session when explicitly closing a terminal tab
    if (tab?.type === "terminal" && tab.sessionId) {
      const { destroySession } = useTerminalStore.getState()
      destroySession(tab.sessionId)
    }
    set((state) => {
      const tabs = state.tabs.filter((t) => t.id !== id)
      const activeTabId =
        state.activeTabId === id
          ? tabs[tabs.length - 1]?.id || null
          : state.activeTabId
      return { tabs, activeTabId }
    })
  },

  setActiveTab: (id: string) => {
    set({ activeTabId: id })
  },

  updateTab: (id: string, updates: Partial<Tab>) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }))
  },

  getActiveTab: () => {
    const { tabs, activeTabId } = get()
    return tabs.find((t) => t.id === activeTabId)
  },

  getRestorableTabs: () => {
    return get().tabs.filter((t) => t.type !== "terminal")
  },

  ensureGitTab: (projectId: string) => {
    const { tabs } = get()
    const hasGit = tabs.some((t) => t.type === "git" && t.projectId === projectId)
    if (!hasGit) {
      get().addTab("git", projectId)
    }
  },

  getProjectTabs: (projectId: string) => {
    return get().tabs.filter((t) => t.projectId === projectId)
  },
}))
