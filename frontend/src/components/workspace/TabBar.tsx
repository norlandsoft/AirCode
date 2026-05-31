import { Plus, X, Terminal, FolderTree, FileCode } from "lucide-react"
import { useTabStore } from "@/stores/useTabStore"
import { useProjectStore } from "@/stores/useProjectStore"
import type { TabType } from "@/lib/types"
import { useState, useRef, useEffect } from "react"

const TAB_ADD_OPTIONS: { type: TabType; label: string; Icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { type: "file_viewer", label: "文件", Icon: FolderTree },
  { type: "terminal", label: "终端", Icon: Terminal },
  { type: "editor", label: "代码", Icon: FileCode },
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
    <div className="flex items-center border-b border-panel-border bg-panel-bg" style={{ height: 32 }}>
      {/* Tab items - grow to fill space */}
      <div className="flex flex-1 overflow-x-auto">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`group flex h-full shrink-0 items-center gap-1.5 cursor-pointer border-r border-panel-border px-3 text-xs ${
              tab.id === activeTabId
                ? "bg-panel-bg text-text-primary"
                : "text-text-muted hover:bg-panel-hover hover:text-text-secondary"
            }`}
          >
            <span className="shrink-0">{tab.icon}</span>
            <span className="max-w-28 truncate">{tab.title}</span>
            {tab.isDirty && (
              <span className="shrink-0 h-2 w-2 rounded-full bg-warning" />
            )}
            {/* Git tab has no close button */}
            {tab.type !== "git" && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  removeTab(tab.id)
                }}
                className="shrink-0 rounded p-0.5 opacity-0 hover:bg-panel-hover group-hover:opacity-100"
              >
                <X size={12} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add button - pinned to the right */}
      <div className="relative shrink-0" ref={menuRef}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          disabled={!activeProjectId}
          className="flex items-center gap-1 border-l border-panel-border px-3 h-8 text-text-secondary hover:bg-panel-hover hover:text-text-primary disabled:opacity-30"
          title="新建标签"
        >
          <Plus size={14} />
        </button>
        {showMenu && (
          <div className="absolute right-0 top-full z-50 mt-1 w-32 rounded border border-panel-border bg-panel-bg py-1 shadow-lg">
            {TAB_ADD_OPTIONS.map(({ type, label, Icon }) => (
              <button
                key={type}
                onClick={() => handleAddTab(type)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:bg-panel-hover hover:text-text-primary"
              >
                <Icon size={14} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
