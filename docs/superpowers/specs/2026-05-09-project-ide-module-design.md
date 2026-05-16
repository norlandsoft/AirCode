# Project IDE Module — Design Spec

## Overview

Build an IDEA-like IDE environment as the Project module in AirCode. When the user clicks the Project sidebar button, they enter a full IDE experience with file tree, code editor, and workspace project management.

## Layout

```
┌──────────────────────────────────────────────────────┐
│ TitleBar  [项目名 ▾]              ─  □  ×            │
├────────┬─────────────────────────────────────────────┤
│        │  Tab1.tsx  × │ Tab2.ts  × │                │
│ 文件树  ├─────────────────────────────────────────────┤
│ 240px  │                                             │
│        │           Monaco Editor                     │
│ 可拖拽  │                                             │
│ 调宽度  │                                             │
│        │                                             │
├────────┴─────────────────────────────────────────────┤
│ StatusBar                                            │
└──────────────────────────────────────────────────────┘
```

- TitleBar: project switcher dropdown when project module is active
- File tree panel: 240px default width, resizable via drag, collapsible
- Editor area: internally managed multi-tab system, independent of App-level TabBar
- App-level TabBar: only manages module-level tabs, not individual files

## File Tree

### Data Structure

```typescript
interface FileNode {
  name: string
  path: string           // absolute path
  isDirectory: boolean
  children?: FileNode[]  // directories only, lazy-loaded
  expanded?: boolean
  loading?: boolean
}
```

### Interactions

- Click directory: toggle expand/collapse, lazy-load children via `files:list` IPC on first expand
- Click file: open in editor
- Right-click context menu: new file, new folder, rename, delete (with confirmation dialog)
- Drag & drop: move file/folder into another folder (via `fs.rename`)

### Project Detection

- `pom.xml` in root → Maven project icon (☕) and label
- `package.json` in root → Node/frontend project icon (📦) and label
- File icons matched by extension using lucide-react icons

### Gitignore Filtering

- Parse `.gitignore` at project root when present
- Filter tree nodes matching gitignore rules (node_modules, .git, dist, etc.)
- No filtering when `.gitignore` absent

### Root Actions

- Project name displayed at top of file tree
- "Open Folder" button to add new projects

## Code Editor

### Multi-Tab System (Internal to ProjectModule)

```typescript
interface EditorTab {
  id: string            // file path as ID
  filePath: string
  fileName: string
  content: string
  originalContent: string
  isDirty: boolean      // content !== originalContent
}
```

### Editor Behavior

- Open file: read via `files:read` IPC, create EditorTab, activate tab
- Re-click open file: switch to existing tab, don't reload
- Edit: Monaco `onChange` updates tab content, marks `isDirty`
- Save: `Cmd/Ctrl+S` → `files:write` IPC, update `originalContent`, clear dirty
- Close tab: if dirty, show confirmation (Save / Don't Save / Cancel); else close directly
- Dirty indicator: small dot on tab label

### Monaco Configuration

- Auto language detection by file extension (Monaco built-in)
- Monospace font, follow system/user settings
- Line numbers, code folding, bracket matching (Monaco defaults)
- Find/Replace: `Ctrl+F` / `Ctrl+H` (Monaco built-in)

### Global Search (Ctrl+Shift+F)

- Collapsible search panel above the editor area
- Input keyword, invoke main process to recursively search all text files in project
- Results: file name + matching line + highlight, click to jump to file and line

## State Management

### New Zustand Store: `useProjectStore`

```typescript
interface ProjectState {
  // Project management
  projects: Project[]
  activeProjectId: string | null

  // File tree
  fileTree: Map<string, FileNode[]>   // indexed by project path
  expandedDirs: Set<string>

  // Editor
  openTabs: EditorTab[]
  activeTabId: string | null

  // Global search
  searchResults: SearchResult[]
  searchQuery: string
}
```

### New IPC Channels

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `files:list` | existing | list directory contents |
| `files:read` | existing | read file content |
| `files:write` | existing | write file |
| `files:stat` | existing | get file info |
| `files:create` | new | create file or folder |
| `files:rename` | new | rename/move |
| `files:delete` | new | delete file or folder |
| `files:search` | new | global text search |
| `gitignore:parse` | new | parse .gitignore rules |

### Persistence

- Open project list saved to SQLite settings (key: `project.list`)
- Active project saved to settings (key: `project.active`)
- Restore project state on app restart

## Title Bar Project Switcher

### Location

TitleBar left side, visible when project module is active.

### Dropdown Structure

- Project list with current project highlighted
- Project icon: Maven → ☕, package.json → 📦, other → 📁
- "Open Project..." option at bottom: triggers native folder dialog (`dialog.showOpenDialog`)
- Close button (×) on each project item: closes project (prompts if unsaved files)

### TitleBar Changes

- Conditional render in `TitleBar.tsx`: show switcher when `activeModuleId === 'project'`
- Folder dialog via IPC calling `dialog.showOpenDialogSync` in main process

## Implementation Approach

Custom-built file tree component (no external tree library). Full control over drag-and-drop, context menus, project icons, and gitignore integration. Monaco Editor for code editing with built-in language support.
