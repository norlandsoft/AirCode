import { Plus, X } from "lucide-react"
import { useTabStore } from "@/stores/useTabStore"
import { useProjectStore } from "@/stores/useProjectStore"
import type { TabType } from "@/lib/types"
import { useState, useRef, useEffect } from "react"

const TAB_TYPE_OPTIONS: { type: TabType; label: string; icon: string }[] = [
  { type: "terminal", label: "终端", icon: "🖥️" },
  { type: "editor", label: "编辑器", icon: "📝" },
  { type: "file_viewer", label: "文件", icon: "📁" },
  { type: "git", label: "Git", icon: "🔀" },
]

export function TabBar() {
  const tabs = useTabStore((s) => s.tabs)
  const activeTabId = useTabStore((s) => s.activeTabId)
  const setActiveTab = useTabStore((s) => s.setActiveTab)
  const removeTab = useTabStore((s) => s.removeTab)
  const addTab = useTabStore((s) => s.addTab)
  const activeProjectId = useProjectStore((s) => s.activeProjectId)

  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showMenu) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [showMenu])

  const handleAddTab = (type: TabType) => {
    if (!activeProjectId) return
    addTab(type, activeProjectId)
    setShowMenu(false)
  }

  return (
    <div className="flex h-9 items-end border-b border-panel-border bg-panel-bg overflow-x-auto">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`group flex h-8 min-w-0 max-w-40 items-center gap-1.5 cursor-pointer border-r border-panel-border px-3 text-xs ${
            tab.id === activeTabId
              ? "border-b-2 border-b-accent bg-panel-bg text-text-primary"
              : "text-text-muted hover:bg-panel-hover hover:text-text-secondary"
          }`}
        >
          <span className="shrink-0">{tab.icon}</span>
          <span className="truncate">{tab.title}</span>
          {tab.isDirty && (
            <span className="shrink-0 h-2 w-2 rounded-full bg-warning" />
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              removeTab(tab.id)
            }}
            className="shrink-0 rounded p-0.5 opacity-0 hover:bg-panel-hover group-hover:opacity-100"
          >
            <X size={12} />
          </button>
        </div>
      ))}

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          disabled={!activeProjectId}
          className="flex h-8 w-8 items-center justify-center text-text-muted hover:bg-panel-hover hover:text-text-primary disabled:opacity-30"
          title="新建标签"
        >
          <Plus size={14} />
        </button>
        {showMenu && (
          <div className="absolute left-0 top-full z-50 mt-1 w-36 rounded border border-panel-border bg-panel-bg py-1 shadow-lg">
            {TAB_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.type}
                onClick={() => handleAddTab(opt.type)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:bg-panel-hover hover:text-text-primary"
              >
                <span>{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
