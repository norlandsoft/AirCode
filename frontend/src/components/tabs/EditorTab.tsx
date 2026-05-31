import { useEffect, useState, useCallback } from "react"
import Editor from "@monaco-editor/react"
import { useEditorStore } from "@/stores/useEditorStore"
import { useTabStore } from "@/stores/useTabStore"

interface EditorTabProps {
  tabId: string
  filePath?: string
}

export function EditorTab({ tabId, filePath }: EditorTabProps) {
  const openFile = useEditorStore((s) => s.openFile)
  const saveFile = useEditorStore((s) => s.saveFile)
  const updateContent = useEditorStore((s) => s.updateContent)
  const activeFile = useEditorStore((s) => s.activeFile)
  const updateTab = useTabStore((s) => s.updateTab)

  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!filePath || loaded) return
    openFile(filePath).then((file) => {
      if (file) {
        updateTab(tabId, { title: file.name })
        setLoaded(true)
      }
    })
  }, [filePath, loaded]) // eslint-disable-line react-hooks/exhaustive-deps

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

  if (!activeFile) {
    return (
      <div className="flex h-full items-center justify-center text-text-muted">
        <p>选择或打开一个文件开始编辑</p>
      </div>
    )
  }

  return (
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
  )
}
