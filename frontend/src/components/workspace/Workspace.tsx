import { useEffect } from "react"
import { TabBar } from "./TabBar"
import { useTabStore } from "@/stores/useTabStore"
import { useProjectStore } from "@/stores/useProjectStore"
import { TerminalTab } from "@/components/tabs/TerminalTab"
import { CodeTab } from "@/components/tabs/CodeTab"
import { GitTab } from "@/components/tabs/GitTab"

export function Workspace() {
  const tabs = useTabStore((s) => s.tabs)
  const activeTabId = useTabStore((s) => s.activeTabId)
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const ensureGitTab = useTabStore((s) => s.ensureGitTab)
  const switchProject = useTabStore((s) => s.switchProject)

  // When active project changes, restore its last active tab and ensure git tab exists
  useEffect(() => {
    if (activeProjectId) {
      switchProject(activeProjectId)
      ensureGitTab(activeProjectId)
    }
  }, [activeProjectId, switchProject, ensureGitTab])

  // Filter tabs for current project
  const projectTabs = activeProjectId
    ? tabs.filter((t) => t.projectId === activeProjectId)
    : []

  if (!activeProjectId) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex h-full items-center justify-center text-text-muted">
          <div className="text-center">
            <p className="text-lg">欢迎使用 AirCode</p>
            <p className="mt-2 text-sm">请在左侧面板添加一个项目目录开始使用</p>
          </div>
        </div>
      </div>
    )
  }

  const hasActiveTab = projectTabs.some((t) => t.id === activeTabId)

  return (
    <div className="flex h-full flex-col">
      <TabBar />
      <div className="flex-1 relative">
        {/* Empty state when no active tab */}
        {!hasActiveTab && (
          <div className="absolute inset-0 flex items-center justify-center text-text-muted">
            <div className="text-center">
              <p>点击 + 创建标签页</p>
              <p className="mt-1 text-xs">代码 / 终端</p>
            </div>
          </div>
        )}
        {/* Render all project tabs, hide inactive ones via CSS */}
        {projectTabs.map((tab) => (
          <div
            key={tab.id}
            className="absolute inset-0"
            style={{ display: tab.id === activeTabId ? "block" : "none" }}
          >
            {tab.type === "terminal" && <TerminalTab tab={tab} />}
            {tab.type === "code" && <CodeTab tab={tab} />}
            {tab.type === "git" && <GitTab tab={tab} />}
          </div>
        ))}
      </div>
    </div>
  )
}
