import { FolderOpen, Plus, Trash2 } from "lucide-react"
import { useProjectStore } from "@/stores/useProjectStore"
import { api, isPyWebView } from "@/lib/api"

export function ProjectList() {
  const projects = useProjectStore((s) => s.projects)
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const setActiveProject = useProjectStore((s) => s.setActiveProject)
  const removeProject = useProjectStore((s) => s.removeProject)
  const addProject = useProjectStore((s) => s.addProject)

  const handleAddProject = async () => {
    if (isPyWebView) {
      const a = await api()
      const result = await a.open_folder_dialog()
      if (result.path) {
        addProject(result.path as string)
      }
    } else {
      addProject("/tmp")
    }
  }

  return (
    <div className="flex h-full w-56 flex-col border-r border-panel-border bg-panel-bg">
      <div className="flex items-center justify-between px-3 py-2 border-b border-panel-border">
        <span className="text-xs font-medium uppercase tracking-wider text-text-muted">
          项目
        </span>
        <button
          onClick={handleAddProject}
          className="rounded p-1 text-text-muted hover:bg-panel-hover hover:text-text-primary"
          title="添加项目"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {projects.length === 0 && (
          <div className="px-3 py-4 text-center text-xs text-text-muted">
            点击 + 添加项目目录
          </div>
        )}
        {projects.map((project) => (
          <div
            key={project.id}
            onClick={() => setActiveProject(project.id)}
            className={`group flex items-center gap-2 px-3 py-1.5 cursor-pointer text-sm ${
              project.id === activeProjectId
                ? "bg-panel-active text-text-primary"
                : "text-text-secondary hover:bg-panel-hover hover:text-text-primary"
            }`}
            title={project.path}
          >
            <FolderOpen size={14} className="shrink-0 text-accent" />
            <span className="truncate flex-1">{project.name}</span>
            {project.isGitRepo && (
              <span className="text-[10px] text-text-muted">git</span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation()
                removeProject(project.id)
              }}
              className="hidden rounded p-0.5 text-text-muted hover:text-danger group-hover:block"
              title="移除项目"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
