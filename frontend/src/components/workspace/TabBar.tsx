import { X, Terminal, FolderTree, Zap } from "lucide-react"
import { useTabStore } from "@/stores/useTabStore"
import { useProjectStore } from "@/stores/useProjectStore"
import { useCallback } from "react"

export function TabBar() {
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const allTabs = useTabStore((s) => s.tabs)
  const activeTabId = useTabStore((s) => s.activeTabId)
  const setActiveTab = useTabStore((s) => s.setActiveTab)
  const removeTab = useTabStore((s) => s.removeTab)
  const addTab = useTabStore((s) => s.addTab)

  // Filter tabs by project outside the zustand selector to avoid infinite re-render
  const tabs = activeProjectId
    ? allTabs.filter((t) => t.projectId === activeProjectId)
    : []

  const handleAddTab = useCallback(
    (type: "code" | "terminal" | "pipeline") => {
      if (!activeProjectId) return
      addTab(type, activeProjectId)
    },
    [activeProjectId, addTab]
  )

  return (
    <div className="flex items-stretch border-b border-panel-border bg-panel-bg" style={{ height: 36 }}>
      {/* Tab items - grow to fill space */}
      <div className="flex flex-1 overflow-x-auto">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`group flex h-full shrink-0 items-center gap-1.5 cursor-pointer border-r border-panel-border px-3 text-xs border-t-[3px] ${
              tab.id === activeTabId
                ? "border-t-blue-500 text-text-primary"
                : "border-t-transparent text-text-muted hover:bg-panel-hover hover:text-text-secondary"
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

      {/* Add buttons - pinned to the right */}
      <button
        onClick={() => handleAddTab("terminal")}
        disabled={!activeProjectId}
        className="flex items-center gap-1 border-l border-panel-border px-2.5 h-full text-text-secondary hover:bg-panel-hover hover:text-text-primary disabled:opacity-30"
        title="新建终端标签"
      >
        <Terminal size={14} />
      </button>
      <button
        onClick={() => handleAddTab("code")}
        disabled={!activeProjectId}
        className="flex items-center gap-1 border-l border-panel-border px-2.5 h-full text-text-secondary hover:bg-panel-hover hover:text-text-primary disabled:opacity-30"
        title="新建代码标签"
      >
        <FolderTree size={14} />
      </button>
      <button
        onClick={() => handleAddTab("pipeline")}
        disabled={!activeProjectId}
        className="flex items-center gap-1 border-l border-panel-border px-2.5 h-full text-text-secondary hover:bg-panel-hover hover:text-text-primary disabled:opacity-30"
        title="新建流水线标签"
      >
        <Zap size={14} />
      </button>
    </div>
  )
}
