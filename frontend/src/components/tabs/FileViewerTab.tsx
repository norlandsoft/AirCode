import { useState, useEffect, useCallback } from "react"
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from "lucide-react"
import { useProjectStore } from "@/stores/useProjectStore"
import { useTabStore } from "@/stores/useTabStore"
import type { FileEntry } from "@/lib/types"
import { api } from "@/lib/api"

interface FileViewerTabProps {
  tabId: string
}

export function FileViewerTab({ tabId: _tabId }: FileViewerTabProps) {
  const fileTree = useProjectStore((s) => s.fileTree)
  const activeProject = useProjectStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId)
  )
  const loadFileTree = useProjectStore((s) => s.loadFileTree)
  const addTab = useTabStore((s) => s.addTab)

  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())
  const [subDirs, setSubDirs] = useState<Map<string, FileEntry[]>>(new Map())
  const [previewContent, setPreviewContent] = useState<string | null>(null)
  const [previewName, setPreviewName] = useState<string>("")

  useEffect(() => {
    if (activeProject) {
      loadFileTree(activeProject.path)
    }
  }, [activeProject]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleDir = useCallback(async (dirPath: string) => {
    if (expandedDirs.has(dirPath)) {
      setExpandedDirs((prev) => {
        const next = new Set(prev)
        next.delete(dirPath)
        return next
      })
    } else {
      setExpandedDirs((prev) => {
        const next = new Set(prev)
        next.add(dirPath)
        return next
      })
      const a = await api()
      const result = await a.project.list_directory(dirPath)
      if (result.entries) {
        setSubDirs((prev) => {
          const next = new Map(prev)
          next.set(dirPath, result.entries as FileEntry[])
          return next
        })
      }
    }
  }, [expandedDirs])

  const handleFileClick = useCallback(async (filePath: string, fileName: string) => {
    const a = await api()
    const result = await a.editor.read_file(filePath)
    if (result.content) {
      setPreviewContent(result.content as string)
      setPreviewName(fileName)
    }
  }, [])

  const openInEditor = useCallback((filePath: string, fileName: string) => {
    if (!activeProject) return
    addTab("editor", activeProject.id, { filePath, title: fileName })
  }, [activeProject, addTab])

  const renderTree = (entries: FileEntry[], depth: number = 0) => {
    return entries.map((entry) => {
      const isExpanded = expandedDirs.has(entry.path)
      const subEntries = subDirs.get(entry.path)

      return (
        <div key={entry.path}>
          <div
            className="flex items-center gap-1 cursor-pointer py-0.5 hover:bg-panel-hover text-xs"
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
            onClick={() => {
              if (entry.is_dir) {
                toggleDir(entry.path)
              } else {
                handleFileClick(entry.path, entry.name)
              }
            }}
            onDoubleClick={() => {
              if (!entry.is_dir) {
                openInEditor(entry.path, entry.name)
              }
            }}
          >
            {entry.is_dir ? (
              <>
                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                {isExpanded ? <FolderOpen size={14} className="text-text-secondary" /> : <Folder size={14} className="text-text-secondary" />}
              </>
            ) : (
              <>
                <span className="w-3" />
                <File size={14} className="text-text-secondary" />
              </>
            )}
            <span className="ml-1 truncate text-text-secondary">{entry.name}</span>
          </div>
          {entry.is_dir && isExpanded && subEntries && renderTree(subEntries, depth + 1)}
        </div>
      )
    })
  }

  return (
    <div className="flex h-full">
      <div className="w-64 overflow-y-auto border-r border-panel-border p-1">
        {activeProject ? renderTree(fileTree) : (
          <div className="p-4 text-center text-xs text-text-muted">请先选择一个项目</div>
        )}
      </div>
      <div className="flex-1 overflow-auto p-4">
        {previewContent ? (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-text-muted">{previewName} (预览)</span>
            </div>
            <pre className="whitespace-pre-wrap font-mono text-xs text-text-secondary">
              {previewContent}
            </pre>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-text-muted">
            单击文件预览，双击在编辑器中打开
          </div>
        )}
      </div>
    </div>
  )
}
