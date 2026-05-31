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
      {/* Header */}
      <div className="flex items-center justify-between px-3 border-b border-panel-border" style={{ height: 36 }}>
        <span className="text-[0.9rem] font-medium text-text-muted">
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

      {/* Project list - 0.85rem, two-line items */}
      <div className="flex-1 overflow-y-auto py-1">
        {projects.length === 0 && (
          <div className="px-3 py-4 text-center text-[0.85rem] text-text-muted">
            点击 + 添加项目目录
          </div>
        )}
        {projects.map((project) => (
          <div
            key={project.id}
            onClick={() => setActiveProject(project.id)}
            className={`group flex items-start gap-2 px-3 py-2 cursor-pointer ${
              project.id === activeProjectId
                ? "bg-panel-active text-text-primary"
                : "text-text-secondary hover:bg-panel-hover hover:text-text-primary"
            }`}
          >
            <FolderOpen size={14} className="mt-0.5 shrink-0 text-text-secondary" />
            {/* Two-line content: name + path */}
            <div className="flex-1 min-w-0">
              {editingId === project.id ? (
                <input
                  ref={inputRef}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={handleKeyDown}
                  className="w-full rounded bg-panel-bg border border-accent px-1 py-0 text-[0.85rem] text-text-primary outline-none"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <>
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[0.85rem] font-medium">{project.name}</span>
                    {project.isGitRepo && (
                      <span className="shrink-0 text-[0.625rem] text-text-muted">git</span>
                    )}
                  </div>
                  <div className="truncate text-[0.7rem] text-text-muted">{project.path}</div>
                </>
              )}
            </div>
            {/* Action buttons on the right */}
            <div className="hidden shrink-0 items-center gap-0.5 pt-0.5 group-hover:flex">
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
