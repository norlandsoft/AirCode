import { create } from "zustand"
import { api } from "@/lib/api"
import type { AppSettings, ProjectConfig, WorkspaceData, Secrets } from "@/lib/types"

const DEFAULT_SETTINGS: AppSettings = {
  version: 1,
  theme: "dark",
  fontSize: 16,
  terminal: { shell: "/bin/zsh", fontSize: 14 },
  editor: { tabSize: 2, wordWrap: true, fontSize: 14 },
  recentProjects: [],
  window: { width: 1400, height: 900 },
}

interface SettingsState {
  settings: AppSettings
  projectConfigs: Map<string, ProjectConfig>
  loaded: boolean

  loadSettings: () => Promise<void>
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>
  loadProjectConfig: (path: string) => Promise<void>
  updateProjectConfig: (path: string, partial: Partial<ProjectConfig>) => Promise<void>
  loadWorkspace: (path: string) => Promise<WorkspaceData | null>
  saveWorkspace: (path: string, data: WorkspaceData) => Promise<void>
  loadSecrets: () => Promise<Secrets>
  updateSecrets: (partial: Partial<Secrets>) => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  projectConfigs: new Map(),
  loaded: false,

  loadSettings: async () => {
    const a = await api()
    const result = await a.settings.get_settings()
    if (result.error) return
    set({ settings: result as unknown as AppSettings, loaded: true })
  },

  updateSettings: async (partial: Partial<AppSettings>) => {
    const a = await api()
    const result = await a.settings.update_settings(partial as Record<string, unknown>)
    if (result.error) return
    // Reload to get the merged result
    await get().loadSettings()
  },

  loadProjectConfig: async (path: string) => {
    const a = await api()
    const result = await a.settings.get_project_config(path)
    if (result.error) return
    set((state) => {
      const configs = new Map(state.projectConfigs)
      configs.set(path, result as unknown as ProjectConfig)
      return { projectConfigs: configs }
    })
  },

  updateProjectConfig: async (path: string, partial: Partial<ProjectConfig>) => {
    const a = await api()
    const result = await a.settings.update_project_config(path, partial as Record<string, unknown>)
    if (result.error) return
    await get().loadProjectConfig(path)
  },

  loadWorkspace: async (path: string) => {
    const a = await api()
    const result = await a.settings.get_workspace(path)
    if (result.error || !result.projectPath) return null
    return result as unknown as WorkspaceData
  },

  saveWorkspace: async (path: string, data: WorkspaceData) => {
    const a = await api()
    await a.settings.save_workspace(path, data as unknown as Record<string, unknown>)
  },

  loadSecrets: async () => {
    const a = await api()
    const result = await a.settings.get_secrets()
    return (result as unknown as Secrets) || { gitTokens: {}, sshKeyPath: null, customTokens: {} }
  },

  updateSecrets: async (partial: Partial<Secrets>) => {
    const a = await api()
    await a.settings.update_secrets(partial as Record<string, unknown>)
  },
}))
