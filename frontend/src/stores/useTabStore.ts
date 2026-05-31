import { create } from "zustand"
import type { Tab, TabType } from "@/lib/types"

interface TabState {
  tabs: Tab[]
  activeTabId: string | null

  addTab: (type: TabType, projectId: string, extra?: Partial<Tab>) => string
  removeTab: (id: string) => void
  setActiveTab: (id: string) => void
  updateTab: (id: string, updates: Partial<Tab>) => void
  getActiveTab: () => Tab | undefined
}

const TAB_ICONS: Record<TabType, string> = {
  terminal: "🖥️",
  editor: "📝",
  file_viewer: "📁",
  git: "🔀",
}

const TAB_TITLES: Record<TabType, string> = {
  terminal: "终端",
  editor: "编辑器",
  file_viewer: "文件",
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

    set((state) => ({
      tabs: [...state.tabs, tab],
      activeTabId: id,
    }))

    return id
  },

  removeTab: (id: string) => {
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
}))
