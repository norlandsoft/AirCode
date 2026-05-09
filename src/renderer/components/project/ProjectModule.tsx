import { useEffect, useCallback, useState } from 'react'
import { FolderOpen, Search, PanelLeftClose, PanelLeft } from 'lucide-react'
import type { AirCodeModule, FileNode, SearchResult, EditorTab } from '../../../shared/types'
import { useProjectStore } from '@/stores/project'
import { ResizablePanel } from './ResizablePanel'
import { FileTree } from './FileTree'
import { EditorTabs } from './EditorTabs'
import { CodeEditor } from './CodeEditor'
import { GlobalSearch } from './GlobalSearch'

function Project() {
  const {
    projects,
    activeProjectId,
    setActiveProject,
    addProject,
    removeProject,
    openTabs,
    activeTabId,
    openFileTab,
    closeFileTab,
    setActiveTab,
    isSearchOpen,
    toggleSearch,
    setIgnoredPatterns,
    fileTree,
    setFileTree
  } = useProjectStore()

  const [treeVisible, setTreeVisible] = useState(true)
  const [revealLine, setRevealLine] = useState<number | undefined>(undefined)
  const activeProject = projects.find((p) => p.id === activeProjectId)
  const activeTab = openTabs.find((t) => t.id === activeTabId) ?? null

  useEffect(() => {
    loadProjects()
  }, [])

  useEffect(() => {
    if (activeProject) {
      loadGitignore(activeProject.path)
      if (!fileTree[activeProject.path]) {
        window.api.files.list(activeProject.path).then((entries) => {
          const nodes = (entries as FileNode[]).sort((a, b) => {
            if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
            return a.name.localeCompare(b.name)
          })
          setFileTree(activeProject.path, nodes)
        })
      }
    }
  }, [activeProjectId])

  async function loadProjects() {
    const listStr = await window.api.settings.get('project.list')
    if (listStr) {
      try {
        const saved: Array<{ id: string; name: string; path: string; type: string }> = JSON.parse(listStr)
        for (const p of saved) {
          addProject({ id: p.id, name: p.name, path: p.path, type: p.type as 'maven' | 'node' | 'unknown' })
        }
      } catch { /* ignore parse errors */ }
    }
    const activeId = await window.api.settings.get('project.active')
    if (activeId) setActiveProject(activeId)
  }

  async function loadGitignore(projectPath: string) {
    const content = await window.api.project.parseGitignore(projectPath)
    if (content) {
      setIgnoredPatterns(projectPath, content)
    }
  }

  async function saveProjects() {
    const { projects, activeProjectId } = useProjectStore.getState()
    await window.api.settings.set('project.list', JSON.stringify(projects))
    if (activeProjectId) {
      await window.api.settings.set('project.active', activeProjectId)
    }
  }

  const handleOpenProject = useCallback(async () => {
    const folderPath = await window.api.project.openDialog()
    if (!folderPath) return

    const entries = await window.api.files.list(folderPath) as FileNode[]
    let type: 'maven' | 'node' | 'unknown' = 'unknown'
    if (entries.some((e) => e.name === 'pom.xml')) type = 'maven'
    else if (entries.some((e) => e.name === 'package.json')) type = 'node'

    const name = folderPath.split('/').pop() ?? 'Untitled'
    const id = folderPath

    addProject({ id, name, path: folderPath, type })
    setActiveProject(id)
    saveProjects()
  }, [addProject, setActiveProject])

  const handleCloseProject = useCallback((id: string) => {
    const dirtyTabs = useProjectStore.getState().openTabs.filter((t) => t.isDirty)
    if (dirtyTabs.length > 0) {
      const answer = confirm(`有 ${dirtyTabs.length} 个文件未保存，确定关闭项目吗？`)
      if (!answer) return
    }
    removeProject(id)
    saveProjects()
  }, [removeProject])

  const handleSelectProject = useCallback((id: string) => {
    setActiveProject(id)
    saveProjects()
  }, [setActiveProject])

  const handleFileSelect = useCallback(async (node: FileNode) => {
    if (node.isDirectory) return
    const existing = useProjectStore.getState().openTabs.find((t) => t.id === node.path)
    if (existing) {
      setActiveTab(node.path)
      return
    }
    const result = await window.api.files.read(node.path)
    const tab: EditorTab = {
      id: node.path,
      filePath: node.path,
      fileName: node.name,
      content: result.content,
      originalContent: result.content,
      isDirty: false
    }
    openFileTab(tab)
  }, [openFileTab, setActiveTab])

  const handleCloseTab = useCallback((id: string) => {
    const tab = useProjectStore.getState().openTabs.find((t) => t.id === id)
    if (tab?.isDirty) {
      const answer = confirm(`"${tab.fileName}" 有未保存的修改，确定关闭吗？`)
      if (!answer) return
    }
    closeFileTab(id)
  }, [closeFileTab])

  const handleSearchResult = useCallback(async (result: SearchResult) => {
    await handleFileSelect({ name: result.fileName, path: result.filePath, isDirectory: false })
    setRevealLine(result.line)
  }, [handleFileSelect])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault()
        toggleSearch()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleSearch])

  if (!activeProject) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <FolderOpen size={48} className="mx-auto mb-3 text-[var(--foreground-subtle)]" />
          <h3 className="mb-1 text-sm font-medium text-[var(--foreground)]">打开项目</h3>
          <p className="mb-4 text-xs text-[var(--foreground-subtle)]">选择一个文件夹开始编码</p>
          <button
            className="rounded-md bg-[var(--primary)] px-4 py-2 text-xs font-medium text-white hover:bg-[var(--primary-hover)] transition-colors"
            onClick={handleOpenProject}
          >
            打开文件夹
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      <ResizablePanel side="left" defaultWidth={240} collapsed={!treeVisible}>
        <FileTree
          projectPath={activeProject.path}
          projectName={activeProject.name}
          onFileSelect={handleFileSelect}
        />
      </ResizablePanel>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-8 items-center gap-1 border-b border-[var(--border)] px-2">
          <button
            className="rounded p-1 text-[var(--foreground-subtle)] hover:bg-[var(--hover-bg)] hover:text-[var(--foreground)]"
            onClick={() => setTreeVisible(!treeVisible)}
            title={treeVisible ? '隐藏文件树' : '显示文件树'}
          >
            {treeVisible ? <PanelLeftClose size={15} /> : <PanelLeft size={15} />}
          </button>
          <button
            className={`rounded p-1 transition-colors ${
              isSearchOpen
                ? 'bg-[var(--sidebar-active)] text-[var(--sidebar-active-fg)]'
                : 'text-[var(--foreground-subtle)] hover:bg-[var(--hover-bg)] hover:text-[var(--foreground)]'
            }`}
            onClick={toggleSearch}
            title="全局搜索 (Ctrl+Shift+F)"
          >
            <Search size={15} />
          </button>
        </div>

        {isSearchOpen && (
          <GlobalSearch projectPath={activeProject.path} onResultClick={handleSearchResult} />
        )}

        <EditorTabs
          tabs={openTabs}
          activeTabId={activeTabId}
          onSelect={setActiveTab}
          onClose={handleCloseTab}
        />

        <div className="flex-1 overflow-hidden">
          {activeTab ? (
            <CodeEditor tab={activeTab} revealLine={revealLine} />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-[var(--foreground-subtle)]">
              点击左侧文件开始编辑
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export const ProjectModule: AirCodeModule = {
  id: 'project',
  name: 'Project',
  icon: 'project',
  component: Project
}
