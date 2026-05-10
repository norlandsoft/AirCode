import { X } from 'lucide-react'
import type { EditorTab } from '../../../shared/types'

interface EditorTabsProps {
  tabs: EditorTab[]
  activeTabId: string | null
  onSelect: (id: string) => void
  onClose: (id: string) => void
}

export function EditorTabs({ tabs, activeTabId, onSelect, onClose }: EditorTabsProps) {
  if (tabs.length === 0) return null

  return (
    <div className="flex items-center border-b border-[var(--border)] bg-[var(--sidebar-bg)] overflow-x-auto" style={{ height: 'var(--height-tab)' }}>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`group flex h-full shrink-0 cursor-pointer items-center gap-1.5 border-r border-[var(--border)] px-3 text-[var(--text-xs)] transition-colors ${
            activeTabId === tab.id
              ? 'bg-[var(--background)] text-[var(--foreground)]'
              : 'text-[var(--foreground-subtle)] hover:bg-[var(--hover-bg)]'
          }`}
          onClick={() => onSelect(tab.id)}
        >
          {tab.isDirty && (
            <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
          )}
          <span className="truncate max-w-[120px]">{tab.fileName}</span>
          <button
            className="ml-1 shrink-0 rounded-[var(--radius-sm)] p-0.5 opacity-0 transition-opacity hover:bg-[var(--hover-bg)] group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation()
              onClose(tab.id)
            }}
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  )
}
