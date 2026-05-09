import { moduleRegistry } from '@/modules/registry'
import { useAppStore } from '@/stores/app'

export function StatusBar() {
  const { activeModuleId } = useAppStore()
  const activeModule = activeModuleId ? moduleRegistry.get(activeModuleId) : null

  return (
    <div className="flex h-6 items-center justify-between border-t border-[var(--border)] bg-[var(--sidebar-bg)] px-3 text-[10px] text-[var(--sidebar-fg)]">
      <div className="flex items-center gap-3">
        {activeModule && <span>{activeModule.name}</span>}
      </div>
      <div className="flex items-center gap-3">
        <span>AirCode v0.1.0</span>
      </div>
    </div>
  )
}
