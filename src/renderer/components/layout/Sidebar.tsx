import { moduleRegistry } from '@/modules/registry'
import { useAppStore } from '@/stores/app'
import { Icon } from '@/lib/icons'

export function Sidebar() {
  const { activeModuleId, setActiveModule } = useAppStore()
  const modules = moduleRegistry.getAll()

  // Last module is settings, keep it at the bottom
  const mainModules = modules.slice(0, -1)
  const settingsModule = modules[modules.length - 1]

  return (
    <div className="flex flex-col items-center border-r border-[var(--border)] bg-[var(--sidebar-bg)]" style={{ width: 'var(--height-sidebar)' }}>
      <div className="h-2" />
      <div className="flex flex-1 flex-col items-center gap-0.5">
        {mainModules.map((mod) => (
          <button
            key={mod.id}
            className={`flex items-center justify-center rounded-[var(--radius-md)] transition-colors ${
              activeModuleId === mod.id
                ? 'bg-[var(--sidebar-active)] text-[var(--sidebar-active-fg)]'
                : 'text-[var(--sidebar-fg)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--foreground-muted)]'
            }`}
            style={{ width: '36px', height: '36px' }}
            onClick={() => setActiveModule(mod.id)}
            title={mod.name}
          >
            <Icon name={mod.icon} size={20} />
          </button>
        ))}
      </div>
      {settingsModule && (
        <div className="pb-2">
          <button
            className={`flex items-center justify-center rounded-[var(--radius-md)] transition-colors ${
              activeModuleId === settingsModule.id
                ? 'bg-[var(--sidebar-active)] text-[var(--sidebar-active-fg)]'
                : 'text-[var(--sidebar-fg)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--foreground-muted)]'
            }`}
            style={{ width: '36px', height: '36px' }}
            onClick={() => setActiveModule(settingsModule.id)}
            title={settingsModule.name}
          >
            <Icon name={settingsModule.icon} size={20} />
          </button>
        </div>
      )}
    </div>
  )
}
