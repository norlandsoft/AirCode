import { useEffect } from "react"
import { TabBar } from "./TabBar"
import { useTabStore } from "@/stores/useTabStore"
import { useProjectStore } from "@/stores/useProjectStore"
import { TerminalTab } from "@/components/tabs/TerminalTab"
import { EditorTab } from "@/components/tabs/EditorTab"
import { FileViewerTab } from "@/components/tabs/FileViewerTab"
import { GitTab } from "@/components/tabs/GitTab"

export function Workspace() {
  const activeTab = useTabStore((s) =>
    s.tabs.find((t) => t.id === s.activeTabId)
  )
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const ensureGitTab = useTabStore((s) => s.ensureGitTab)

  // When active project changes, ensure git tab exists
  useEffect(() => {
    if (activeProjectId) {
      ensureGitTab(activeProjectId)
    }
  }, [activeProjectId, ensureGitTab])

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

  return (
    <div className="flex h-full flex-col">
      <TabBar />
      <div className="flex-1 overflow-hidden">
        {!activeTab && (
          <div className="flex h-full items-center justify-center text-text-muted">
            <div className="text-center">
              <p>点击 + 创建标签页</p>
              <p className="mt-1 text-xs">文件 / 终端 / 代码</p>
            </div>
          </div>
        )}
        {activeTab?.type === "terminal" && <TerminalTab tabId={activeTab.id} />}
        {activeTab?.type === "editor" && <EditorTab tabId={activeTab.id} filePath={activeTab.filePath} />}
        {activeTab?.type === "file_viewer" && <FileViewerTab tabId={activeTab.id} />}
        {activeTab?.type === "git" && <GitTab tabId={activeTab.id} />}
      </div>
    </div>
  )
}
