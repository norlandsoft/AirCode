import { useProjectStore } from "@/stores/useProjectStore"
import { useTabStore } from "@/stores/useTabStore"

export function StatusBar() {
  const activeProject = useProjectStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId)
  )
  const activeTab = useTabStore((s) =>
    s.tabs.find((t) => t.id === s.activeTabId)
  )

  return (
    <div className="flex h-6 items-center justify-between border-t border-panel-border bg-panel-bg px-3 text-xs text-text-muted select-none">
      <div className="flex items-center gap-3">
        {activeProject && (
          <span className="flex items-center gap-1">
            <span>📁</span>
            <span>{activeProject.name}</span>
          </span>
        )}
        {activeProject?.isGitRepo && (
          <span className="flex items-center gap-1">
            <span>🔀</span>
            <span>git</span>
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span>UTF-8</span>
        <span>LF</span>
        {activeTab && (
          <span className="text-text-secondary">{activeTab.title}</span>
        )}
      </div>
    </div>
  )
}
