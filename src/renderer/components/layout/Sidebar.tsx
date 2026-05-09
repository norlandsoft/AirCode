import { moduleRegistry } from '@/modules/registry'
import { useAppStore } from '@/stores/app'

interface SidebarProps {
  collapsed: boolean
}

export function Sidebar({ collapsed }: SidebarProps) {
  const { activeModuleId, setActiveModule, toggleSidebar } = useAppStore()
  const modules = moduleRegistry.getAll()

  return (
    <div
      className={`flex flex-col items-center border-r border-[var(--border)] bg-[var(--sidebar-bg)] transition-all ${
        collapsed ? 'w-12' : 'w-14'
      }`}
    >
      <div className="drag-region flex h-12 w-full items-center justify-center">
        <span className="text-sm font-bold text-[var(--accent)]">AC</span>
      </div>

      <div className="no-drag flex flex-1 flex-col gap-1 py-2">
        {modules.map((mod) => (
          <button
            key={mod.id}
            className={`flex h-10 w-full items-center justify-center rounded-sm text-lg transition-colors hover:bg-[var(--border)] ${
              activeModuleId === mod.id ? 'bg-[var(--border)] text-[var(--accent)]' : 'text-[var(--sidebar-fg)]'
            }`}
            onClick={() => setActiveModule(mod.id)}
            title={mod.name}
          >
            {mod.icon}
          </button>
        ))}
      </div>

      <button
        className="mb-2 flex h-8 w-full items-center justify-center text-[var(--sidebar-fg)] hover:bg-[var(--border)]"
        onClick={toggleSidebar}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? '»' : '«'}
      </button>
    </div>
  )
}
