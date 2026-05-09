import { create } from 'zustand'

interface AppState {
  activeModuleId: string | null
  openTabs: Array<{ moduleId: string; instanceId: string; title: string }>
  activeTabId: string | null
  sidebarCollapsed: boolean
  setActiveModule: (id: string) => void
  openTab: (moduleId: string, instanceId: string, title: string) => void
  closeTab: (instanceId: string) => void
  setActiveTab: (instanceId: string | null) => void
  toggleSidebar: () => void
}

export const useAppStore = create<AppState>((set) => ({
  activeModuleId: null,
  openTabs: [],
  activeTabId: null,
  sidebarCollapsed: false,

  setActiveModule: (id) => set({ activeModuleId: id }),

  openTab: (moduleId, instanceId, title) =>
    set((state) => {
      const exists = state.openTabs.find((t) => t.instanceId === instanceId)
      if (exists) return { activeTabId: instanceId, activeModuleId: moduleId }
      return {
        openTabs: [...state.openTabs, { moduleId, instanceId, title }],
        activeTabId: instanceId,
        activeModuleId: moduleId
      }
    }),

  closeTab: (instanceId) =>
    set((state) => {
      const tabs = state.openTabs.filter((t) => t.instanceId !== instanceId)
      const activeTabId =
        state.activeTabId === instanceId
          ? tabs.length > 0
            ? tabs[tabs.length - 1].instanceId
            : null
          : state.activeTabId
      return { openTabs: tabs, activeTabId }
    }),

  setActiveTab: (instanceId) => {
    if (!instanceId) return set({ activeTabId: null })
    set((state) => {
      const tab = state.openTabs.find((t) => t.instanceId === instanceId)
      return {
        activeTabId: instanceId,
        activeModuleId: tab?.moduleId ?? state.activeModuleId
      }
    })
  },

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }))
}))
