import type { ComponentType } from 'react'

export interface StatusItem {
  id: string
  label: string
  tooltip?: string
  onClick?: () => void
}

export interface AirCodeModule {
  id: string
  name: string
  icon: string
  component: ComponentType
  mainProcessHandlers?: () => void
  statusContributions?: StatusItem[]
}

export interface ModuleRegistry {
  modules: Map<string, AirCodeModule>
  register: (module: AirCodeModule) => void
  unregister: (id: string) => void
  getAll: () => AirCodeModule[]
  get: (id: string) => AirCodeModule | undefined
}
