import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Plus, X, Folder, Package, Coffee } from 'lucide-react'
import type { Project } from '../../../shared/types'

interface ProjectDropdownProps {
  projects: Project[]
  activeProjectId: string | null
  onSelect: (id: string) => void
  onOpen: () => void
  onClose: (id: string) => void
}

function getProjectIcon(type: Project['type']) {
  switch (type) {
    case 'maven': return <Coffee size={14} />
    case 'node': return <Package size={14} />
    default: return <Folder size={14} />
  }
}

export function ProjectDropdown({ projects, activeProjectId, onSelect, onOpen, onClose }: ProjectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const activeProject = projects.find((p) => p.id === activeProjectId)

  return (
    <div ref={ref} className="relative">
      <button
        className="no-drag flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--hover-bg)] transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        {activeProject ? getProjectIcon(activeProject.type) : <Folder size={14} />}
        <span className="max-w-[150px] truncate">{activeProject?.name ?? '选择项目'}</span>
        <ChevronDown size={12} className={`text-[var(--foreground-subtle)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[220px] rounded-md border border-[var(--border)] bg-[var(--background)] py-1 shadow-lg">
          {projects.map((project) => (
            <div
              key={project.id}
              className={`group flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer transition-colors ${
                project.id === activeProjectId
                  ? 'bg-[var(--sidebar-active)] text-[var(--sidebar-active-fg)]'
                  : 'text-[var(--foreground)] hover:bg-[var(--hover-bg)]'
              }`}
              onClick={() => {
                onSelect(project.id)
                setIsOpen(false)
              }}
            >
              {getProjectIcon(project.type)}
              <span className="min-w-0 flex-1 truncate">{project.name}</span>
              <button
                className="shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-[var(--hover-bg)] group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation()
                  onClose(project.id)
                }}
              >
                <X size={12} className="text-[var(--foreground-subtle)]" />
              </button>
            </div>
          ))}
          <div className="my-1 border-t border-[var(--border)]" />
          <button
            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[var(--foreground)] hover:bg-[var(--hover-bg)] transition-colors"
            onClick={() => {
              setIsOpen(false)
              onOpen()
            }}
          >
            <Plus size={14} />
            <span>打开项目...</span>
          </button>
        </div>
      )}
    </div>
  )
}
