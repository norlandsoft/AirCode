# Project IDE Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an IDEA-like IDE environment inside the Project module with file tree, Monaco editor, and workspace project management.

**Architecture:** The Project module is a self-contained IDE with its own internal tab system. The file tree is custom-built (no external library). All file operations go through IPC to the main process. State is managed via a new `useProjectStore` zustand store. The title bar gets a project switcher dropdown when the project module is active.

**Tech Stack:** React 19, TypeScript, Monaco Editor (`@monaco-editor/react`), zustand, lucide-react, `ignore` (npm package for gitignore parsing)

**Note:** This project has no test infrastructure. All verification is done via `npm run dev` and manual inspection. Each task ends with a dev server verification step.

---

## File Structure

### New Files

| File | Purpose |
|------|---------|
| `src/shared/types/project.ts` | Project, FileNode, EditorTab, SearchResult types |
| `src/main/ipc/project.ts` | Project dialog + gitignore IPC handlers |
| `src/renderer/stores/project.ts` | useProjectStore zustand store |
| `src/renderer/components/project/ProjectModule.tsx` | Rewrite — full IDE layout |
| `src/renderer/components/project/FileTree.tsx` | Recursive file tree component |
| `src/renderer/components/project/FileTreeNode.tsx` | Single tree node (file/dir) |
| `src/renderer/components/project/FileTreeContextMenu.tsx` | Right-click context menu |
| `src/renderer/components/project/EditorTabs.tsx` | Internal editor tab bar |
| `src/renderer/components/project/CodeEditor.tsx` | Monaco editor wrapper |
| `src/renderer/components/project/GlobalSearch.tsx` | Global search panel |
| `src/renderer/components/project/ResizablePanel.tsx` | Resizable split panel |
| `src/renderer/components/project/ProjectDropdown.tsx` | Title bar project switcher |

### Modified Files

| File | Changes |
|------|---------|
| `src/shared/types/index.ts` | Export project types |
| `src/shared/types/ipc.ts` | Add new IPC channel types |
| `src/main/ipc/files.ts` | Add create, rename, delete, search handlers |
| `src/main/index.ts` | Register new project IPC handlers |
| `src/preload/index.ts` | Add new IPC channels to bridge |
| `src/renderer/lib/api.ts` | Update ElectronApi interface |
| `src/renderer/components/layout/TitleBar.tsx` | Add project switcher dropdown |

---

### Task 1: Shared Types

**Files:**
- Create: `src/shared/types/project.ts`
- Modify: `src/shared/types/index.ts`
- Modify: `src/shared/types/ipc.ts`

- [ ] **Step 1: Create project types**

```typescript
// src/shared/types/project.ts

export interface Project {
  id: string
  name: string
  path: string
  type: 'maven' | 'node' | 'unknown'
}

export interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
  expanded?: boolean
  loading?: boolean
}

export interface EditorTab {
  id: string
  filePath: string
  fileName: string
  content: string
  originalContent: string
  isDirty: boolean
}

export interface SearchResult {
  filePath: string
  fileName: string
  line: number
  column: number
  text: string
  matchStart: number
  matchEnd: number
}
```

- [ ] **Step 2: Update shared types index**

```typescript
// src/shared/types/index.ts
export * from './ipc'
export * from './module'
export * from './project'
export * from './terminal'
```

- [ ] **Step 3: Update IPC channel types**

Add to `src/shared/types/ipc.ts`:

```typescript
export interface IpcChannel {
  terminal: {
    create: 'terminal:create'
    write: 'terminal:write'
    resize: 'terminal:resize'
    kill: 'terminal:kill'
    onData: 'terminal:on-data'
  }
  files: {
    read: 'files:read'
    write: 'files:write'
    list: 'files:list'
    stat: 'files:stat'
    create: 'files:create'
    rename: 'files:rename'
    delete: 'files:delete'
    search: 'files:search'
    watch: 'files:watch'
    onChange: 'files:on-change'
  }
  project: {
    openDialog: 'project:openDialog'
    parseGitignore: 'project:parseGitignore'
  }
}

export type TerminalCreateOptions = {
  shell?: string
  cwd?: string
  env?: Record<string, string>
  cols?: number
  rows?: number
}

export type FileReadResult = {
  content: string
  encoding: string
}

export type FileCreateOptions = {
  path: string
  type: 'file' | 'directory'
}

export type FileRenameOptions = {
  oldPath: string
  newPath: string
}

export type FileSearchOptions = {
  rootPath: string
  query: string
  maxResults?: number
}
```

- [ ] **Step 4: Commit**

```bash
git add src/shared/types/
git commit -m "feat: add project IDE shared types"
```

---

### Task 2: Main Process IPC Handlers

**Files:**
- Modify: `src/main/ipc/files.ts`
- Create: `src/main/ipc/project.ts`
- Modify: `src/main/index.ts`

- [ ] **Step 1: Add new file operation handlers**

Add these handlers to `src/main/ipc/files.ts` (append inside `registerFileHandlers`, before the closing `}`):

```typescript
  ipcMain.handle('files:create', async (_event, options: { path: string; type: 'file' | 'directory' }) => {
    const { path: targetPath, type } = options
    if (type === 'directory') {
      await mkdir(targetPath, { recursive: true })
    } else {
      const dir = dirname(targetPath)
      await mkdir(dir, { recursive: true })
      await writeFile(targetPath, '', 'utf-8')
    }
  })

  ipcMain.handle('files:rename', async (_event, oldPath: string, newPath: string) => {
    await rename(oldPath, newPath)
  })

  ipcMain.handle('files:delete', async (_event, targetPath: string) => {
    const stats = await stat(targetPath)
    if (stats.isDirectory()) {
      await rm(targetPath, { recursive: true })
    } else {
      await unlink(targetPath)
    }
  })

  ipcMain.handle('files:search', async (_event, rootPath: string, query: string, maxResults = 500) => {
    const results: Array<{ filePath: string; fileName: string; line: number; column: number; text: string; matchStart: number; matchEnd: number }> = []
    const lowerQuery = query.toLowerCase()

    async function walk(dir: string): Promise<void> {
      if (results.length >= maxResults) return
      const entries = await readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (results.length >= maxResults) return
        const fullPath = join(dir, entry.name)
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'build') continue
          await walk(fullPath)
        } else if (entry.isFile()) {
          try {
            const content = await readFile(fullPath, 'utf-8')
            const lines = content.split('\n')
            for (let i = 0; i < lines.length; i++) {
              if (results.length >= maxResults) return
              const lineText = lines[i]
              const idx = lineText.toLowerCase().indexOf(lowerQuery)
              if (idx !== -1) {
                results.push({
                  filePath: fullPath,
                  fileName: entry.name,
                  line: i + 1,
                  column: idx + 1,
                  text: lineText,
                  matchStart: idx,
                  matchEnd: idx + query.length
                })
              }
            }
          } catch {
            // skip binary or unreadable files
          }
        }
      }
    }

    await walk(rootPath)
    return results
  })
```

Also add these imports at the top of `src/main/ipc/files.ts`:

```typescript
import { mkdir, rename, unlink, rm } from 'fs/promises'
import { dirname } from 'path'
```

- [ ] **Step 2: Create project IPC handler**

```typescript
// src/main/ipc/project.ts
import { ipcMain, dialog, BrowserWindow } from 'electron'
import { readFile } from 'fs/promises'
import { join } from 'path'

export function registerProjectHandlers(): void {
  ipcMain.handle('project:openDialog', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: '选择项目文件夹'
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('project:parseGitignore', async (_event, projectPath: string) => {
    const gitignorePath = join(projectPath, '.gitignore')
    try {
      const content = await readFile(gitignorePath, 'utf-8')
      return content
    } catch {
      return null
    }
  })
}
```

- [ ] **Step 3: Register project handlers in main process**

In `src/main/index.ts`, add import and registration:

```typescript
import { registerProjectHandlers } from './ipc/project'
```

Add to `registerIpcHandlers()`:

```typescript
function registerIpcHandlers(): void {
  registerTerminalHandlers()
  registerFileHandlers()
  registerSettingsHandlers()
  registerProjectHandlers()
}
```

- [ ] **Step 4: Commit**

```bash
git add src/main/
git commit -m "feat: add project and file operation IPC handlers"
```

---

### Task 3: Preload Bridge & API Types

**Files:**
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/lib/api.ts`

- [ ] **Step 1: Update preload bridge**

Add to the `api` object in `src/preload/index.ts`:

```typescript
  files: {
    read: (path: string, encoding?: string) => ipcRenderer.invoke('files:read', path, encoding),
    write: (path: string, content: string, encoding?: string) => ipcRenderer.invoke('files:write', path, content, encoding),
    list: (path: string) => ipcRenderer.invoke('files:list', path),
    stat: (path: string) => ipcRenderer.invoke('files:stat', path),
    create: (options: { path: string; type: 'file' | 'directory' }) => ipcRenderer.invoke('files:create', options),
    rename: (oldPath: string, newPath: string) => ipcRenderer.invoke('files:rename', oldPath, newPath),
    delete: (path: string) => ipcRenderer.invoke('files:delete', path),
    search: (rootPath: string, query: string, maxResults?: number) => ipcRenderer.invoke('files:search', rootPath, query, maxResults)
  },
```

Add a new `project` namespace:

```typescript
  project: {
    openDialog: () => ipcRenderer.invoke('project:openDialog'),
    parseGitignore: (projectPath: string) => ipcRenderer.invoke('project:parseGitignore', projectPath)
  },
```

- [ ] **Step 2: Update API type declarations**

Replace `src/renderer/lib/api.ts` entirely:

```typescript
import type { FileNode, SearchResult } from '../../shared/types'

export interface ElectronApi {
  terminal: {
    create: (opts?: Record<string, unknown>) => Promise<{ id: string; pid: number }>
    write: (id: string, data: string) => Promise<void>
    resize: (id: string, cols: number, rows: number) => Promise<void>
    kill: (id: string) => Promise<void>
    onData: (callback: (id: string, data: string) => void) => () => void
  }
  files: {
    read: (path: string, encoding?: string) => Promise<{ content: string; encoding: string }>
    write: (path: string, content: string, encoding?: string) => Promise<void>
    list: (path: string) => Promise<FileNode[]>
    stat: (path: string) => Promise<{ size: number; isFile: boolean; isDirectory: boolean; modifiedAt: Date; createdAt: Date }>
    create: (options: { path: string; type: 'file' | 'directory' }) => Promise<void>
    rename: (oldPath: string, newPath: string) => Promise<void>
    delete: (path: string) => Promise<void>
    search: (rootPath: string, query: string, maxResults?: number) => Promise<SearchResult[]>
  }
  settings: {
    get: (key: string) => Promise<string | null>
    set: (key: string, value: string) => Promise<void>
    getAll: () => Promise<Record<string, string>>
  }
  project: {
    openDialog: () => Promise<string | null>
    parseGitignore: (projectPath: string) => Promise<string | null>
  }
}

declare global {
  interface Window {
    api: ElectronApi
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/preload/index.ts src/renderer/lib/api.ts
git commit -m "feat: update preload bridge and API types for project operations"
```

---

### Task 4: Project Store

**Files:**
- Create: `src/renderer/stores/project.ts`

- [ ] **Step 1: Create the project store**

```typescript
// src/renderer/stores/project.ts
import { create } from 'zustand'
import type { Project, FileNode, EditorTab, SearchResult } from '../../shared/types'

interface ProjectState {
  // Project management
  projects: Project[]
  activeProjectId: string | null
  setProjects: (projects: Project[]) => void
  addProject: (project: Project) => void
  removeProject: (id: string) => void
  setActiveProject: (id: string | null) => void

  // File tree
  fileTree: Record<string, FileNode[]>
  expandedDirs: Set<string>
  setFileTree: (projectPath: string, nodes: FileNode[]) => void
  toggleDir: (path: string) => void
  setExpandedDirs: (dirs: Set<string>) => void
  updateNodeChildren: (parentPath: string, children: FileNode[], projectPath: string) => void

  // Editor
  openTabs: EditorTab[]
  activeTabId: string | null
  openFileTab: (tab: EditorTab) => void
  closeFileTab: (id: string) => void
  setActiveTab: (id: string | null) => void
  updateTabContent: (id: string, content: string) => void
  markTabSaved: (id: string) => void

  // Global search
  searchResults: SearchResult[]
  searchQuery: string
  isSearchOpen: boolean
  setSearchResults: (results: SearchResult[]) => void
  setSearchQuery: (query: string) => void
  toggleSearch: () => void
  setSearchOpen: (open: boolean) => void

  // Gitignore
  ignoredPatterns: Record<string, string>
  setIgnoredPatterns: (projectPath: string, patterns: string) => void
}

export const useProjectStore = create<ProjectState>((set) => ({
  // Project management
  projects: [],
  activeProjectId: null,
  setProjects: (projects) => set({ projects }),
  addProject: (project) =>
    set((state) => {
      if (state.projects.find((p) => p.path === project.path)) return state
      return { projects: [...state.projects, project] }
    }),
  removeProject: (id) =>
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      activeProjectId: state.activeProjectId === id
        ? (state.projects.find((p) => p.id !== id)?.id ?? null)
        : state.activeProjectId
    })),
  setActiveProject: (id) => set({ activeProjectId: id }),

  // File tree
  fileTree: {},
  expandedDirs: new Set(),
  setFileTree: (projectPath, nodes) =>
    set((state) => ({
      fileTree: { ...state.fileTree, [projectPath]: nodes }
    })),
  toggleDir: (path) =>
    set((state) => {
      const next = new Set(state.expandedDirs)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return { expandedDirs: next }
    }),
  setExpandedDirs: (dirs) => set({ expandedDirs: dirs }),
  updateNodeChildren: (parentPath, children, projectPath) =>
    set((state) => {
      const rootNodes = state.fileTree[projectPath]
      if (!rootNodes) return state

      function update(nodes: FileNode[]): FileNode[] {
        return nodes.map((node) => {
          if (node.path === parentPath) {
            return { ...node, children, loading: false, expanded: true }
          }
          if (node.children) {
            return { ...node, children: update(node.children) }
          }
          return node
        })
      }

      return {
        fileTree: { ...state.fileTree, [projectPath]: update(rootNodes) }
      }
    }),

  // Editor
  openTabs: [],
  activeTabId: null,
  openFileTab: (tab) =>
    set((state) => {
      const exists = state.openTabs.find((t) => t.id === tab.id)
      if (exists) return { activeTabId: tab.id }
      return {
        openTabs: [...state.openTabs, tab],
        activeTabId: tab.id
      }
    }),
  closeFileTab: (id) =>
    set((state) => {
      const tabs = state.openTabs.filter((t) => t.id !== id)
      const activeTabId =
        state.activeTabId === id
          ? tabs.length > 0
            ? tabs[tabs.length - 1].id
            : null
          : state.activeTabId
      return { openTabs: tabs, activeTabId }
    }),
  setActiveTab: (id) => set({ activeTabId: id }),
  updateTabContent: (id, content) =>
    set((state) => ({
      openTabs: state.openTabs.map((t) =>
        t.id === id ? { ...t, content, isDirty: content !== t.originalContent } : t
      )
    })),
  markTabSaved: (id) =>
    set((state) => ({
      openTabs: state.openTabs.map((t) =>
        t.id === id ? { ...t, originalContent: t.content, isDirty: false } : t
      )
    })),

  // Global search
  searchResults: [],
  searchQuery: '',
  isSearchOpen: false,
  setSearchResults: (results) => set({ searchResults: results }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  toggleSearch: () => set((state) => ({ isSearchOpen: !state.isSearchOpen })),
  setSearchOpen: (open) => set({ isSearchOpen: open }),

  // Gitignore
  ignoredPatterns: {},
  setIgnoredPatterns: (projectPath, patterns) =>
    set((state) => ({
      ignoredPatterns: { ...state.ignoredPatterns, [projectPath]: patterns }
    }))
}))
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/stores/project.ts
git commit -m "feat: add project zustand store"
```

---

### Task 5: Install gitignore parser

- [ ] **Step 1: Install the `ignore` package**

```bash
cd /opt/AirCode && npm install ignore && npm install -D @types/ignore
```

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add ignore package for gitignore parsing"
```

---

### Task 6: Resizable Panel Component

**Files:**
- Create: `src/renderer/components/project/ResizablePanel.tsx`

- [ ] **Step 1: Create the resizable panel**

```typescript
// src/renderer/components/project/ResizablePanel.tsx
import { useRef, useCallback, type ReactNode } from 'react'

interface ResizablePanelProps {
  side: 'left' | 'right'
  defaultWidth: number
  minWidth?: number
  maxWidth?: number
  collapsed?: boolean
  children: ReactNode
  onWidthChange?: (width: number) => void
}

export function ResizablePanel({
  side,
  defaultWidth,
  minWidth = 150,
  maxWidth = 500,
  collapsed = false,
  children,
  onWidthChange
}: ResizablePanelProps) {
  const widthRef = useRef(defaultWidth)
  const isDragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true
    startX.current = e.clientX
    startWidth.current = widthRef.current

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      const diff = side === 'left' ? e.clientX - startX.current : startX.current - e.clientX
      const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidth.current + diff))
      widthRef.current = newWidth
      onWidthChange?.(newWidth)
      // Directly update DOM for performance during drag
      const panel = document.getElementById('resizable-panel-content')
      if (panel) panel.style.width = `${newWidth}px`
    }

    const handleMouseUp = () => {
      isDragging.current = false
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [side, minWidth, maxWidth, onWidthChange])

  if (collapsed) {
    return <div className="hidden" />
  }

  return (
    <div className="relative flex h-full shrink-0" style={{ width: widthRef.current }}>
      <div id="resizable-panel-content" className="h-full overflow-hidden" style={{ width: widthRef.current }}>
        {children}
      </div>
      <div
        className="absolute top-0 bottom-0 z-10 w-1 cursor-col-resize hover:bg-[var(--primary)] transition-colors"
        style={{ [side === 'left' ? 'right' : 'left']: 0 }}
        onMouseDown={handleMouseDown}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/project/ResizablePanel.tsx
git commit -m "feat: add resizable panel component"
```

---

### Task 7: File Tree Context Menu

**Files:**
- Create: `src/renderer/components/project/FileTreeContextMenu.tsx`

- [ ] **Step 1: Create context menu component**

```typescript
// src/renderer/components/project/FileTreeContextMenu.tsx
import { useEffect, useRef } from 'react'

export interface ContextMenuAction {
  label: string
  onClick: () => void
  danger?: boolean
}

interface FileTreeContextMenuProps {
  x: number
  y: number
  actions: ContextMenuAction[]
  onClose: () => void
}

export function FileTreeContextMenu({ x, y, actions, onClose }: FileTreeContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  // Adjust position to stay within viewport
  const adjustedX = Math.min(x, window.innerWidth - 180)
  const adjustedY = Math.min(y, window.innerHeight - actions.length * 32 - 10)

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[160px] rounded-md border border-[var(--border)] bg-[var(--background)] py-1 shadow-lg"
      style={{ left: adjustedX, top: adjustedY }}
    >
      {actions.map((action, i) => (
        <button
          key={i}
          className={`w-full px-3 py-1.5 text-left text-xs transition-colors ${
            action.danger
              ? 'text-red-600 hover:bg-red-50'
              : 'text-[var(--foreground)] hover:bg-[var(--hover-bg)]'
          }`}
          onClick={() => {
            action.onClick()
            onClose()
          }}
        >
          {action.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/project/FileTreeContextMenu.tsx
git commit -m "feat: add file tree context menu component"
```

---

### Task 8: File Tree Node Component

**Files:**
- Create: `src/renderer/components/project/FileTreeNode.tsx`

- [ ] **Step 1: Create the tree node component**

This is a large file. It handles rendering, click, right-click, drag, and drop for a single file/directory node.

```typescript
// src/renderer/components/project/FileTreeNode.tsx
import { useState, useCallback, type DragEvent } from 'react'
import { ChevronRight, File, Folder, FolderOpen, Loader2 } from 'lucide-react'
import type { FileNode } from '../../../shared/types'
import { FileTreeContextMenu, type ContextMenuAction } from './FileTreeContextMenu'

interface FileTreeNodeProps {
  node: FileNode
  depth: number
  selectedPath: string | null
  expandedDirs: Set<string>
  onToggleDir: (path: string) => void
  onFileClick: (node: FileNode) => void
  onCreateFile: (parentPath: string, type: 'file' | 'directory') => void
  onRename: (node: FileNode, newName: string) => void
  onDelete: (node: FileNode) => void
  onMove: (sourcePath: string, targetDir: string) => void
}

const EXTENSION_ICONS: Record<string, string> = {
  ts: '🔷', tsx: '🔷', js: '🟨', jsx: '🟨',
  json: '📋', css: '🎨', html: '🌐',
  py: '🐍', java: '☕', xml: '📄',
  md: '📝', yml: '⚙️', yaml: '⚙️',
  sh: '🖥️', sql: '🗃️', go: '🐹',
  rs: '🦀', rb: '💎', php: '🐘'
}

function getFileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return EXTENSION_ICONS[ext] || ''
}

export function FileTreeNode({
  node,
  depth,
  selectedPath,
  expandedDirs,
  onToggleDir,
  onFileClick,
  onCreateFile,
  onRename,
  onDelete,
  onMove
}: FileTreeNodeProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(node.name)
  const [isDragOver, setIsDragOver] = useState(false)
  const isExpanded = expandedDirs.has(node.path)
  const isSelected = selectedPath === node.path

  const handleClick = useCallback(() => {
    if (node.isDirectory) {
      onToggleDir(node.path)
    } else {
      onFileClick(node)
    }
  }, [node, onToggleDir, onFileClick])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }, [])

  const handleRenameSubmit = useCallback(() => {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== node.name) {
      onRename(node, trimmed)
    }
    setIsRenaming(false)
  }, [renameValue, node, onRename])

  // Drag handlers
  const handleDragStart = useCallback((e: DragEvent) => {
    e.dataTransfer.setData('text/plain', node.path)
    e.dataTransfer.effectAllowed = 'move'
  }, [node.path])

  const handleDragOver = useCallback((e: DragEvent) => {
    if (node.isDirectory) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      setIsDragOver(true)
    }
  }, [node.isDirectory])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const sourcePath = e.dataTransfer.getData('text/plain')
    if (sourcePath && sourcePath !== node.path) {
      onMove(sourcePath, node.path)
    }
  }, [node.path, onMove])

  const contextActions: ContextMenuAction[] = node.isDirectory
    ? [
        { label: '新建文件', onClick: () => onCreateFile(node.path, 'file') },
        { label: '新建文件夹', onClick: () => onCreateFile(node.path, 'directory') },
        { label: '重命名', onClick: () => { setRenameValue(node.name); setIsRenaming(true) } },
        { label: '删除', onClick: () => onDelete(node), danger: true }
      ]
    : [
        { label: '重命名', onClick: () => { setRenameValue(node.name); setIsRenaming(true) } },
        { label: '删除', onClick: () => onDelete(node), danger: true }
      ]

  return (
    <>
      <div
        className={`flex cursor-pointer items-center gap-1 py-0.5 pr-2 text-xs select-none ${
          isSelected ? 'bg-[var(--sidebar-active)] text-[var(--sidebar-active-fg)]' : 'text-[var(--foreground)] hover:bg-[var(--hover-bg)]'
        } ${isDragOver ? 'bg-[var(--primary-lighter)] outline outline-1 outline-[var(--primary)]' : ''}`}
        style={{ paddingLeft: depth * 16 + 8 }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {node.isDirectory ? (
          <>
            <ChevronRight
              size={14}
              className={`shrink-0 text-[var(--foreground-subtle)] transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            />
            {node.loading ? (
              <Loader2 size={14} className="shrink-0 animate-spin text-[var(--foreground-subtle)]" />
            ) : isExpanded ? (
              <FolderOpen size={14} className="shrink-0 text-amber-500" />
            ) : (
              <Folder size={14} className="shrink-0 text-amber-500" />
            )}
          </>
        ) : (
          <>
            <span className="w-[14px] shrink-0" />
            <span className="shrink-0 text-xs leading-none">{getFileIcon(node.name)}</span>
          </>
        )}
        {isRenaming ? (
          <input
            className="ml-1 min-w-0 flex-1 rounded border border-[var(--primary)] bg-[var(--background)] px-1 py-0 text-xs outline-none"
            value={renameValue}
            autoFocus
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRenameSubmit()
              if (e.key === 'Escape') setIsRenaming(false)
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="ml-1 truncate">{node.name}</span>
        )}
      </div>
      {node.isDirectory && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              expandedDirs={expandedDirs}
              onToggleDir={onToggleDir}
              onFileClick={onFileClick}
              onCreateFile={onCreateFile}
              onRename={onRename}
              onDelete={onDelete}
              onMove={onMove}
            />
          ))}
        </div>
      )}
      {contextMenu && (
        <FileTreeContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          actions={contextActions}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/project/FileTreeNode.tsx
git commit -m "feat: add file tree node component with context menu and drag-drop"
```

---

### Task 9: File Tree Component

**Files:**
- Create: `src/renderer/components/project/FileTree.tsx`

- [ ] **Step 1: Create the file tree container**

This component loads the root file listing, handles gitignore filtering, and orchestrates node interactions.

```typescript
// src/renderer/components/project/FileTree.tsx
import { useEffect, useCallback, useState } from 'react'
import { FolderPlus, RefreshCw } from 'lucide-react'
import ignore from 'ignore'
import type { FileNode } from '../../../shared/types'
import { useProjectStore } from '@/stores/project'
import { FileTreeNode } from './FileTreeNode'

interface FileTreeProps {
  projectPath: string
  projectName: string
  onFileSelect: (node: FileNode) => void
}

export function FileTree({ projectPath, projectName, onFileSelect }: FileTreeProps) {
  const {
    fileTree,
    expandedDirs,
    setFileTree,
    toggleDir,
    updateNodeChildren,
    ignoredPatterns
  } = useProjectStore()

  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [newItemParent, setNewItemParent] = useState<{ path: string; type: 'file' | 'directory' } | null>(null)
  const [newItemName, setNewItemName] = useState('')

  const rootNodes = fileTree[projectPath] ?? []
  const ig = ignore()

  // Load gitignore
  useEffect(() => {
    if (ignoredPatterns[projectPath]) {
      ig.add(ignoredPatterns[projectPath])
    }
  }, [projectPath, ignoredPatterns])

  // Load root nodes
  useEffect(() => {
    loadDirectory(projectPath)
  }, [projectPath])

  const loadDirectory = useCallback(async (dirPath: string) => {
    const entries = await window.api.files.list(dirPath)
    const nodes: FileNode[] = (entries as FileNode[])
      .filter((e) => {
        const gitignoreContent = ignoredPatterns[projectPath]
        if (gitignoreContent) {
          const ig = ignore().add(gitignoreContent)
          const relativePath = e.path.replace(projectPath + '/', '')
          return !ig.ignores(relativePath)
        }
        return true
      })
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
        return a.name.localeCompare(b.name)
      })

    if (dirPath === projectPath) {
      setFileTree(projectPath, nodes)
    }
    return nodes
  }, [projectPath, ignoredPatterns])

  const handleToggleDir = useCallback(async (dirPath: string) => {
    toggleDir(dirPath)
    // Lazy load children on first expand
    const existingNodes = fileTree[projectPath]
    if (existingNodes) {
      const findNode = (nodes: FileNode[]): FileNode | undefined => {
        for (const n of nodes) {
          if (n.path === dirPath) return n
          if (n.children) {
            const found = findNode(n.children)
            if (found) return found
          }
        }
        return undefined
      }
      const node = findNode(existingNodes)
      if (node && !node.children) {
        // Mark as loading
        updateNodeChildren(dirPath, [], projectPath)
        const children = await loadDirectory(dirPath)
        updateNodeChildren(dirPath, children, projectPath)
      }
    }
  }, [projectPath, fileTree, toggleDir, loadDirectory, updateNodeChildren])

  const handleCreateFile = useCallback(async (parentPath: string, type: 'file' | 'directory') => {
    setNewItemParent({ path: parentPath, type })
    setNewItemName(type === 'file' ? 'untitled' : 'new-folder')
  }, [])

  const submitNewItem = useCallback(async () => {
    if (!newItemParent || !newItemName.trim()) return
    const fullPath = `${newItemParent.path}/${newItemName.trim()}`
    await window.api.files.create({ path: fullPath, type: newItemParent.type })
    setNewItemParent(null)
    setNewItemName('')
    // Reload parent directory
    const children = await loadDirectory(newItemParent.path)
    updateNodeChildren(newItemParent.path, children, projectPath)
  }, [newItemParent, newItemName, projectPath, loadDirectory, updateNodeChildren])

  const handleRename = useCallback(async (node: FileNode, newName: string) => {
    const parentDir = node.path.substring(0, node.path.lastIndexOf('/'))
    const newPath = `${parentDir}/${newName}`
    await window.api.files.rename(node.path, newPath)
    // Reload parent directory
    const children = await loadDirectory(parentDir)
    updateNodeChildren(parentDir, children, projectPath)
  }, [projectPath, loadDirectory, updateNodeChildren])

  const handleDelete = useCallback(async (node: FileNode) => {
    if (!confirm(`确定删除 "${node.name}"？`)) return
    await window.api.files.delete(node.path)
    // Reload parent directory
    const parentDir = node.path.substring(0, node.path.lastIndexOf('/'))
    const children = await loadDirectory(parentDir)
    updateNodeChildren(parentDir, children, projectPath)
  }, [projectPath, loadDirectory, updateNodeChildren])

  const handleMove = useCallback(async (sourcePath: string, targetDir: string) => {
    const fileName = sourcePath.split('/').pop()!
    const newPath = `${targetDir}/${fileName}`
    await window.api.files.rename(sourcePath, newPath)
    // Reload both source parent and target directories
    const sourceParent = sourcePath.substring(0, sourcePath.lastIndexOf('/'))
    const sourceChildren = await loadDirectory(sourceParent)
    updateNodeChildren(sourceParent, sourceChildren, projectPath)
    const targetChildren = await loadDirectory(targetDir)
    updateNodeChildren(targetDir, targetChildren, projectPath)
  }, [projectPath, loadDirectory, updateNodeChildren])

  const handleRefresh = useCallback(() => {
    loadDirectory(projectPath)
  }, [projectPath, loadDirectory])

  return (
    <div className="flex h-full flex-col bg-[var(--sidebar-bg)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
        <span className="truncate text-xs font-medium text-[var(--foreground)]">{projectName}</span>
        <div className="flex items-center gap-1">
          <button
            className="rounded p-1 text-[var(--foreground-subtle)] hover:bg-[var(--hover-bg)] hover:text-[var(--foreground)]"
            onClick={handleRefresh}
            title="刷新"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-1">
        {rootNodes.map((node) => (
          <FileTreeNode
            key={node.path}
            node={node}
            depth={0}
            selectedPath={selectedPath}
            expandedDirs={expandedDirs}
            onToggleDir={handleToggleDir}
            onFileClick={(n) => {
              setSelectedPath(n.path)
              onFileSelect(n)
            }}
            onCreateFile={handleCreateFile}
            onRename={handleRename}
            onDelete={handleDelete}
            onMove={handleMove}
          />
        ))}
      </div>

      {/* New item input */}
      {newItemParent && (
        <div className="border-t border-[var(--border)] px-3 py-2">
          <input
            className="w-full rounded border border-[var(--primary)] bg-[var(--background)] px-2 py-1 text-xs outline-none"
            value={newItemName}
            autoFocus
            placeholder={newItemParent.type === 'file' ? '文件名' : '文件夹名'}
            onChange={(e) => setNewItemName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitNewItem()
              if (e.key === 'Escape') setNewItemParent(null)
            }}
            onBlur={() => {
              if (newItemName.trim()) submitNewItem()
              else setNewItemParent(null)
            }}
          />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/project/FileTree.tsx
git commit -m "feat: add file tree component with gitignore filtering"
```

---

### Task 10: Editor Tabs Component

**Files:**
- Create: `src/renderer/components/project/EditorTabs.tsx`

- [ ] **Step 1: Create editor tabs**

```typescript
// src/renderer/components/project/EditorTabs.tsx
import { X } from 'lucide-react'
import type { EditorTab } from '../../../shared/types'

interface EditorTabsProps {
  tabs: EditorTab[]
  activeTabId: string | null
  onSelect: (id: string) => void
  onClose: (id: string) => void
}

export function EditorTabs({ tabs, activeTabId, onSelect, onClose }: EditorTabsProps) {
  if (tabs.length === 0) return null

  return (
    <div className="flex h-9 items-center border-b border-[var(--border)] bg-[var(--sidebar-bg)] overflow-x-auto">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`group flex h-full shrink-0 cursor-pointer items-center gap-1.5 border-r border-[var(--border)] px-3 text-xs transition-colors ${
            activeTabId === tab.id
              ? 'bg-[var(--background)] text-[var(--foreground)]'
              : 'text-[var(--foreground-subtle)] hover:bg-[var(--hover-bg)]'
          }`}
          onClick={() => onSelect(tab.id)}
        >
          {tab.isDirty && (
            <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-[var(--primary)]" />
          )}
          <span className="truncate max-w-[120px]">{tab.fileName}</span>
          <button
            className="ml-1 shrink-0 rounded-sm p-0.5 opacity-0 transition-opacity hover:bg-[var(--hover-bg)] group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation()
              onClose(tab.id)
            }}
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/project/EditorTabs.tsx
git commit -m "feat: add editor tabs component"
```

---

### Task 11: Code Editor Component

**Files:**
- Create: `src/renderer/components/project/CodeEditor.tsx`

- [ ] **Step 1: Create Monaco editor wrapper**

```typescript
// src/renderer/components/project/CodeEditor.tsx
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

  // Register Cmd+S save shortcut
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
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/project/CodeEditor.tsx
git commit -m "feat: add Monaco editor component with save shortcut"
```

---

### Task 12: Global Search Component

**Files:**
- Create: `src/renderer/components/project/GlobalSearch.tsx`

- [ ] **Step 1: Create global search panel**

```typescript
// src/renderer/components/project/GlobalSearch.tsx
import { useState, useCallback } from 'react'
import { Search, X, FileText } from 'lucide-react'
import type { SearchResult } from '../../../shared/types'
import { useProjectStore } from '@/stores/project'

interface GlobalSearchProps {
  projectPath: string
  onResultClick: (result: SearchResult) => void
}

export function GlobalSearch({ projectPath, onResultClick }: GlobalSearchProps) {
  const { searchQuery, searchResults, setSearchQuery, setSearchResults } = useProjectStore()
  const [isSearching, setIsSearching] = useState(false)

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return
    setIsSearching(true)
    try {
      const results = await window.api.files.search(projectPath, searchQuery.trim())
      setSearchResults(results)
    } finally {
      setIsSearching(false)
    }
  }, [searchQuery, projectPath, setSearchResults])

  return (
    <div className="border-b border-[var(--border)] bg-[var(--background-alt)]">
      {/* Search input */}
      <div className="flex items-center gap-2 px-3 py-2">
        <Search size={14} className="shrink-0 text-[var(--foreground-subtle)]" />
        <input
          className="min-w-0 flex-1 bg-transparent text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--foreground-subtle)]"
          placeholder="搜索文件内容..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSearch()
          }}
          autoFocus
        />
        {isSearching && <span className="text-xs text-[var(--foreground-subtle)]">搜索中...</span>}
      </div>

      {/* Results */}
      {searchResults.length > 0 && (
        <div className="max-h-[300px] overflow-y-auto border-t border-[var(--border)]">
          {searchResults.map((result, i) => (
            <div
              key={`${result.filePath}-${result.line}-${i}`}
              className="flex cursor-pointer items-start gap-2 px-3 py-1.5 text-xs hover:bg-[var(--hover-bg)]"
              onClick={() => onResultClick(result)}
            >
              <FileText size={12} className="mt-0.5 shrink-0 text-[var(--foreground-subtle)]" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{result.fileName}</span>
                  <span className="text-[var(--foreground-subtle)]">:{result.line}</span>
                </div>
                <div className="truncate text-[var(--foreground-subtle)]">
                  {result.text.slice(0, Math.max(0, result.matchStart))}
                  <mark className="bg-yellow-200 text-[var(--foreground)]">
                    {result.text.slice(result.matchStart, result.matchEnd)}
                  </mark>
                  {result.text.slice(result.matchEnd)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {searchResults.length === 0 && searchQuery && !isSearching && (
        <div className="px-3 py-3 text-center text-xs text-[var(--foreground-subtle)]">
          没有找到结果
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/project/GlobalSearch.tsx
git commit -m "feat: add global search component"
```

---

### Task 13: Project Dropdown Component

**Files:**
- Create: `src/renderer/components/project/ProjectDropdown.tsx`

- [ ] **Step 1: Create project switcher dropdown**

```typescript
// src/renderer/components/project/ProjectDropdown.tsx
import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Plus, X, Folder, Package, Coffee } from 'lucide-react'
import type { Project } from '../../../shared/types'
import { useProjectStore } from '@/stores/project'

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
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/project/ProjectDropdown.tsx
git commit -m "feat: add project dropdown switcher component"
```

---

### Task 14: Project Module Composition

**Files:**
- Modify: `src/renderer/components/project/ProjectModule.tsx`

- [ ] **Step 1: Rewrite ProjectModule as the full IDE layout**

```typescript
// src/renderer/components/project/ProjectModule.tsx
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
    setSearchOpen,
    setIgnoredPatterns,
    fileTree,
    setFileTree
  } = useProjectStore()

  const [treeVisible, setTreeVisible] = useState(true)
  const activeProject = projects.find((p) => p.id === activeProjectId)
  const activeTab = openTabs.find((t) => t.id === activeTabId) ?? null

  // Load projects from settings on mount
  useEffect(() => {
    loadProjects()
  }, [])

  // Load gitignore when project changes
  useEffect(() => {
    if (activeProject) {
      loadGitignore(activeProject.path)
      // Load root file tree if not loaded
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

    // Detect project type
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
    removeProject(id)
    saveProjects()
  }, [removeProject])

  const handleSelectProject = useCallback((id: string) => {
    setActiveProject(id)
    saveProjects()
  }, [setActiveProject])

  const handleFileSelect = useCallback(async (node: FileNode) => {
    if (node.isDirectory) return
    // Check if already open
    const existing = useProjectStore.getState().openTabs.find((t) => t.id === node.path)
    if (existing) {
      setActiveTab(node.path)
      return
    }
    // Read file content
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
  }, [handleFileSelect])

  // Register Ctrl+Shift+F for global search
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

  // No project open — show welcome
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
      {/* File tree panel */}
      <ResizablePanel side="left" defaultWidth={240} collapsed={!treeVisible}>
        <FileTree
          projectPath={activeProject.path}
          projectName={activeProject.name}
          onFileSelect={handleFileSelect}
        />
      </ResizablePanel>

      {/* Editor area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Toolbar */}
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

        {/* Global search */}
        {isSearchOpen && (
          <GlobalSearch projectPath={activeProject.path} onResultClick={handleSearchResult} />
        )}

        {/* Editor tabs */}
        <EditorTabs
          tabs={openTabs}
          activeTabId={activeTabId}
          onSelect={setActiveTab}
          onClose={handleCloseTab}
        />

        {/* Editor content */}
        <div className="flex-1 overflow-hidden">
          {activeTab ? (
            <CodeEditor tab={activeTab} />
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
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/project/ProjectModule.tsx
git commit -m "feat: rewrite ProjectModule as full IDE layout"
```

---

### Task 15: Title Bar Project Switcher Integration

**Files:**
- Modify: `src/renderer/components/layout/TitleBar.tsx`

- [ ] **Step 1: Add project switcher to title bar**

```typescript
// src/renderer/components/layout/TitleBar.tsx
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

    // Persist
    const { projects, activeProjectId } = useProjectStore.getState()
    await window.api.settings.set('project.list', JSON.stringify(projects))
    if (activeProjectId) await window.api.settings.set('project.active', activeProjectId)
  }

  const handleCloseProject = async (id: string) => {
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
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/layout/TitleBar.tsx
git commit -m "feat: integrate project switcher into title bar"
```

---

### Task 16: Verify & Integration Test

- [ ] **Step 1: Run dev server and verify**

```bash
cd /opt/AirCode && npm run dev
```

Verification checklist:
1. Click Project sidebar icon — welcome screen with "打开文件夹" button appears
2. Click "打开文件夹" — native folder dialog opens
3. Select a folder — file tree loads on the left
4. Click a directory in file tree — it expands showing children
5. Click a file — Monaco editor opens with file content
6. Edit file — dirty indicator (blue dot) appears on tab
7. Press Cmd+S — file saves, dirty indicator clears
8. Open multiple files — tabs appear, can switch between them
9. Close a dirty tab — confirmation dialog appears
10. Right-click in file tree — context menu with new file/folder/rename/delete
11. Drag a file onto a folder — file moves
12. Title bar shows project name with dropdown — can switch between projects
13. Ctrl+Shift+F — global search panel opens, can search across files
14. Drag file tree panel divider — panel resizes
15. Click panel toggle button — file tree collapses/expands

- [ ] **Step 2: Fix any issues found during verification**

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete project IDE module with file tree, editor, and project management"
```
