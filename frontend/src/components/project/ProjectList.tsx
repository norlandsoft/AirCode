import { useState, useRef, useEffect } from "react"
import { FolderOpen, Plus, Trash2, Pencil } from "lucide-react"
import { useProjectStore } from "@/stores/useProjectStore"
import { api } from "@/lib/api"

export function ProjectList({ width }: { width: number }) {
  const projects = useProjectStore((s) => s.projects)
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const setActiveProject = useProjectStore((s) => s.setActiveProject)
  const removeProject = useProjectStore((s) => s.removeProject)
  const renameProject = useProjectStore((s) => s.renameProject)
  const addProject = useProjectStore((s) => s.addProject)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingId])

  const handleAddProject = async () => {
    const a = await api()
    const result = await a.open_folder_dialog()
    if (result.path) {
      addProject(result.path as string)
    }
  }

  const startRename = (e: React.MouseEvent, id: string, currentName: string) => {
    e.stopPropagation()
    setEditingId(id)
    setEditValue(currentName)
  }

  const commitRename = () => {
    if (editingId && editValue.trim()) {
      renameProject(editingId, editValue.trim())
    }
    setEditingId(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      commitRename()
    } else if (e.key === "Escape") {
      setEditingId(null)
    }
  }

  return (
    <div className="flex h-full flex-col bg-panel-bg" style={{ width }}>
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
            className={`group flex items-center gap-2 px-3 py-1.5 cursor-pointer text-[0.95rem] ${
              project.id === activeProjectId
                ? "bg-panel-active text-text-primary"
                : "text-text-secondary hover:bg-panel-hover hover:text-text-primary"
            }`}
            title={project.path}
          >
            <FolderOpen size={14} className="shrink-0 text-accent" />
            {editingId === project.id ? (
              <input
                ref={inputRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={handleKeyDown}
                className="flex-1 min-w-0 rounded bg-panel-bg border border-accent px-1 py-0 text-[0.95rem] text-text-primary outline-none"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="truncate flex-1">{project.name}</span>
            )}
            {project.isGitRepo && (
              <span className="text-[0.625rem] text-text-muted">git</span>
            )}
            <div className="hidden items-center gap-0.5 group-hover:flex">
              <button
                onClick={(e) => startRename(e, project.id, project.name)}
                className="rounded p-0.5 text-text-muted hover:text-accent"
                title="重命名"
              >
                <Pencil size={12} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  removeProject(project.id)
                }}
                className="rounded p-0.5 text-text-muted hover:text-danger"
                title="移除项目"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
