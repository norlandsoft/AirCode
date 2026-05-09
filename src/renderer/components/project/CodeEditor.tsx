import { useCallback, useRef, useEffect } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import type { EditorTab } from '../../../shared/types'
import { useProjectStore } from '@/stores/project'

interface CodeEditorProps {
  tab: EditorTab
}

export function CodeEditor({ tab }: CodeEditorProps) {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null)
  const { updateTabContent } = useProjectStore()

  const handleEditorMount: OnMount = useCallback((editor) => {
    editorRef.current = editor
    editor.focus()
  }, [])

  const handleChange = useCallback(
    (value: string | undefined) => {
      if (value !== undefined) {
        updateTabContent(tab.id, value)
      }
    },
    [tab.id, updateTabContent]
  )

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (tab.isDirty) {
          window.api.files.write(tab.filePath, tab.content)
          useProjectStore.getState().markTabSaved(tab.id)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [tab.id, tab.filePath, tab.content, tab.isDirty])

  return (
    <Editor
      height="100%"
      language={getLanguage(tab.fileName)}
      value={tab.content}
      onChange={handleChange}
      onMount={handleEditorMount}
      theme="vs"
      options={{
        fontSize: 13,
        fontFamily: "'JetBrains Mono', Menlo, Consolas, monospace",
        lineNumbers: 'on',
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: 'on',
        padding: { top: 8 },
        renderWhitespace: 'selection',
        bracketPairColorization: { enabled: true }
      }}
    />
  )
}

function getLanguage(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript',
    js: 'javascript', jsx: 'javascript',
    json: 'json', css: 'css', html: 'html',
    py: 'python', java: 'java', xml: 'xml',
    md: 'markdown', yml: 'yaml', yaml: 'yaml',
    sh: 'shell', sql: 'sql', go: 'go',
    rs: 'rust', rb: 'ruby', php: 'php',
    vue: 'html', svelte: 'html',
    dockerfile: 'dockerfile',
    gitignore: 'plaintext'
  }
  if (fileName === 'Dockerfile') return 'dockerfile'
  if (fileName === '.gitignore') return 'plaintext'
  return map[ext] ?? 'plaintext'
}
