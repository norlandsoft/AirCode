import { useAppStore } from '@/stores/app'
import { useProjectStore } from '@/stores/project'
import { ProjectDropdown } from '@/components/project/ProjectDropdown'

export function TitleBar() {
  const { activeModuleId } = useAppStore()
  const { projects, activeProjectId, setActiveProject, addProject, removeProject } = useProjectStore()

  const showProjectSwitcher = activeModuleId === 'project'

  const handleOpenProject = async () => {
    const folderPath = await window.api.project.openDialog()
    if (!folderPath) return

    const entries = await window.api.files.list(folderPath) as Array<{ name: string; isDirectory: boolean }>
    let type: 'maven' | 'node' | 'unknown' = 'unknown'
    if (entries.some((e) => e.name === 'pom.xml')) type = 'maven'
    else if (entries.some((e) => e.name === 'package.json')) type = 'node'

    const name = folderPath.split('/').pop() ?? 'Untitled'
    const id = folderPath
    addProject({ id, name, path: folderPath, type })
    setActiveProject(id)

    const { projects, activeProjectId } = useProjectStore.getState()
    await window.api.settings.set('project.list', JSON.stringify(projects))
    if (activeProjectId) await window.api.settings.set('project.active', activeProjectId)
  }

  const handleCloseProject = async (id: string) => {
    const dirtyTabs = useProjectStore.getState().openTabs.filter((t) => t.isDirty)
    if (dirtyTabs.length > 0) {
      const answer = confirm(`有 ${dirtyTabs.length} 个文件未保存，确定关闭项目吗？`)
      if (!answer) return
    }
    removeProject(id)
    const { projects, activeProjectId } = useProjectStore.getState()
    await window.api.settings.set('project.list', JSON.stringify(projects))
    if (activeProjectId) await window.api.settings.set('project.active', activeProjectId)
  }

  return (
    <div className="drag-region flex h-[32px] items-center border-b border-[var(--border)] bg-[var(--titlebar-bg)] pl-[78px] pr-4">
      {showProjectSwitcher ? (
        <ProjectDropdown
          projects={projects}
          activeProjectId={activeProjectId}
          onSelect={setActiveProject}
          onOpen={handleOpenProject}
          onClose={handleCloseProject}
        />
      ) : (
        <span className="text-sm font-semibold text-[var(--foreground)] select-none">AirCode</span>
      )}
    </div>
  )
}
