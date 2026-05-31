import { useEffect } from "react"
import { TitleBar } from "@/components/layout/TitleBar"
import { StatusBar } from "@/components/layout/StatusBar"
import { ProjectList } from "@/components/project/ProjectList"
import { Workspace } from "@/components/workspace/Workspace"
import { useProjectStore } from "@/stores/useProjectStore"
import { useTabStore } from "@/stores/useTabStore"
import { useEditorStore } from "@/stores/useEditorStore"
import { useSettingsStore } from "@/stores/useSettingsStore"

export default function App() {
  const loadFromStorage = useProjectStore((s) => s.loadFromStorage)
  const addTab = useTabStore((s) => s.addTab)
  const setActiveTab = useTabStore((s) => s.setActiveTab)
  const openFile = useEditorStore((s) => s.openFile)
  const updateContent = useEditorStore((s) => s.updateContent)
  const loadWorkspace = useSettingsStore((s) => s.loadWorkspace)
  const saveWorkspace = useSettingsStore((s) => s.saveWorkspace)

  // Load projects and restore workspace on mount
  useEffect(() => {
    async function init() {
      await loadFromStorage()
      const activeProjectId = useProjectStore.getState().activeProjectId
      if (!activeProjectId) return

      const workspace = await loadWorkspace(activeProjectId)
      if (!workspace || !workspace.tabs || workspace.tabs.length === 0) return

      // Restore non-terminal tabs
      for (const tab of workspace.tabs) {
        if (tab.type === "terminal") continue
        const newId = addTab(tab.type, activeProjectId, {
          filePath: tab.filePath,
          title: tab.title,
        })
        // Restore draft content for editor tabs
        if (tab.type === "editor" && tab.filePath && workspace.drafts?.[tab.filePath]) {
          const file = await openFile(tab.filePath)
          if (file) {
            updateContent(tab.filePath, workspace.drafts[tab.filePath])
          }
        }
        // Restore the active tab
        if (tab.id === workspace.activeTabId) {
          setActiveTab(newId)
        }
      }
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Save workspace on close
  useEffect(() => {
    const handleBeforeUnload = () => {
      const activeProjectId = useProjectStore.getState().activeProjectId
      if (!activeProjectId) return

      const tabs = useTabStore.getState().getRestorableTabs()
      const drafts = useEditorStore.getState().getDirtyDrafts()
      const activeTabId = useTabStore.getState().activeTabId

      const workspaceData = {
        projectPath: activeProjectId,
        activeTabId: activeTabId || "",
        tabs: tabs.map((t) => ({
          id: t.id,
          type: t.type,
          filePath: t.filePath,
          title: t.title,
        })),
        drafts,
      }

      saveWorkspace(activeProjectId, workspaceData)
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [saveWorkspace])

  return (
    <div className="flex h-screen flex-col">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <ProjectList />
        <Workspace />
      </div>
      <StatusBar />
    </div>
  )
}
