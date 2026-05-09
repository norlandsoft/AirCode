import type { AirCodeModule, ModuleRegistry } from '../../shared/types'

class ModuleRegistryImpl implements ModuleRegistry {
  modules: Map<string, AirCodeModule> = new Map()

  register(module: AirCodeModule): void {
    if (this.modules.has(module.id)) {
      console.warn(`Module ${module.id} is already registered, overwriting.`)
    }
    this.modules.set(module.id, module)
  }

  unregister(id: string): void {
    this.modules.delete(id)
  }

  getAll(): AirCodeModule[] {
    return Array.from(this.modules.values())
  }

  get(id: string): AirCodeModule | undefined {
    return this.modules.get(id)
  }
}

export const moduleRegistry = new ModuleRegistryImpl()
