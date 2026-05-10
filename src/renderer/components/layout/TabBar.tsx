import { useAppStore } from '@/stores/app'

export function TabBar() {
  const { openTabs, activeTabId, setActiveTab, closeTab } = useAppStore()

  if (openTabs.length === 0) return null

  return (
    <div className="drag-region flex items-center border-b border-[var(--border)] bg-[var(--sidebar-bg)]" style={{ height: 'var(--height-tab)' }}>
      {openTabs.map((tab) => (
        <div
          key={tab.instanceId}
          className={`no-drag group flex h-full items-center gap-2 border-r border-[var(--border)] px-3 text-[var(--text-xs)] transition-colors ${
            activeTabId === tab.instanceId
              ? 'bg-[var(--background)] text-[var(--primary)]'
              : 'text-[var(--foreground-subtle)] hover:bg-[var(--hover-bg)]'
          }`}
          onClick={() => setActiveTab(tab.instanceId)}
        >
          <span>{tab.title}</span>
          <button
            className="ml-1 rounded-[var(--radius-sm)] px-0.5 text-[var(--foreground-subtle)] opacity-0 transition-opacity hover:bg-[var(--hover-bg)] group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation()
              closeTab(tab.instanceId)
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
