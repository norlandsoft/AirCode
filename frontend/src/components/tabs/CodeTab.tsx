import { useState, useEffect, useCallback } from "react"
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from "lucide-react"
import Editor from "@monaco-editor/react"
import { useProjectStore } from "@/stores/useProjectStore"
import { useTabStore } from "@/stores/useTabStore"
import { useEditorStore } from "@/stores/useEditorStore"
import type { FileEntry } from "@/lib/types"
import { api } from "@/lib/api"

interface CodeTabProps {
  tabId: string
}

export function CodeTab({ tabId }: CodeTabProps) {
  const fileTree = useProjectStore((s) => s.fileTree)
  const activeProject = useProjectStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId)
  )
  const loadFileTree = useProjectStore((s) => s.loadFileTree)

  const openFile = useEditorStore((s) => s.openFile)
  const saveFile = useEditorStore((s) => s.saveFile)
  const updateContent = useEditorStore((s) => s.updateContent)
  const activeFile = useEditorStore((s) => s.activeFile)
  const updateTab = useTabStore((s) => s.updateTab)

  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())
  const [subDirs, setSubDirs] = useState<Map<string, FileEntry[]>>(new Map())

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
    const file = await openFile(filePath)
    if (file) {
      updateTab(tabId, { title: fileName, filePath })
    }
  }, [openFile, updateTab, tabId])

  const handleChange = useCallback(
    (value: string | undefined) => {
      if (!activeFile || !value) return
      updateContent(activeFile.path, value)
      updateTab(tabId, { isDirty: true })
    },
    [activeFile, tabId, updateContent, updateTab]
  )

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault()
        if (activeFile) {
          saveFile(activeFile.path).then((ok) => {
            if (ok) updateTab(tabId, { isDirty: false })
          })
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [activeFile, tabId, saveFile, updateTab])

  const renderTree = (entries: FileEntry[], depth: number = 0) => {
    return entries.map((entry) => {
      const isExpanded = expandedDirs.has(entry.path)
      const subEntries = subDirs.get(entry.path)
      const isActive = activeFile?.path === entry.path

      return (
        <div key={entry.path}>
          <div
            className={`flex items-center gap-1 cursor-pointer py-0.5 hover:bg-panel-hover text-xs ${isActive ? "bg-panel-hover text-text-primary" : ""}`}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
            onClick={() => {
              if (entry.is_dir) {
                toggleDir(entry.path)
              } else {
                handleFileClick(entry.path, entry.name)
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
                <File size={14} className={isActive ? "text-text-primary" : "text-text-secondary"} />
              </>
            )}
            <span className={`ml-1 truncate ${isActive ? "text-text-primary" : "text-text-secondary"}`}>{entry.name}</span>
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
      <div className="flex-1 overflow-hidden">
        {activeFile ? (
          <Editor
            height="100%"
            language={activeFile.language}
            value={activeFile.content}
            onChange={handleChange}
            theme="vs"
            options={{
              fontSize: 14,
              fontFamily: '"SF Mono", Menlo, Monaco, "Courier New", monospace',
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              padding: { top: 8 },
              lineNumbers: "on",
              renderLineHighlight: "line",
              wordWrap: "on",
              tabSize: 2,
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-text-muted">
            单击文件开始编辑
          </div>
        )}
      </div>
    </div>
  )
}
