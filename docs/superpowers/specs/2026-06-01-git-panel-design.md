# Git Panel Full Client — Design Spec

## Overview

Upgrade the GitTab from a basic status viewer to a full-featured Git client. The left panel splits into two tabs: **Changes** and **History**. A branch selector sits at the top. A commit box at the bottom is shared across both tabs. The right panel displays diffs.

## Architecture

**Pattern**: zustand store + sub-components (consistent with `usePipelineStore`).

### New/Modified Files

| File | Action | Description |
|------|--------|-------------|
| `frontend/src/stores/useGitStore.ts` | New | Central Git state management |
| `frontend/src/components/tabs/GitTab.tsx` | Rewrite | Shell component rendering sub-components |
| `frontend/src/lib/types.ts` | Modify | Add Git-related types |
| `frontend/src/lib/api.ts` | Modify | Add git API methods + mock |
| `backend/api/git.py` | Modify | Add backend API methods |

## Layout

```
┌─────────────────────────────────────────────────┐
│ GitTab                                          │
│ ┌──────────────┬──────────────────────────────┐ │
│ │ Left 320px   │ Right diff panel (flex-1)    │ │
│ │              │                              │ │
│ │ [Branch ⌄]   │                              │ │
│ │              │   Diff content (monospace)   │ │
│ │ [Changes|历史]│                              │ │
│ │ ──────────── │                              │ │
│ │              │                              │ │
│ │ File list /  │                              │ │
│ │ Commit list  │                              │ │
│ │              │                              │ │
│ │ ──────────── │                              │ │
│ │ Commit input │                              │ │
│ │ [Commit btn] │                              │ │
│ └──────────────┴──────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

## Backend API Additions

All methods added to `GitApi` class in `backend/api/git.py`.

| Method | Git Command | Description |
|--------|-------------|-------------|
| `add(project_path, file_path)` | `git add {file}` / `git add -A` | Stage specific file or all |
| `reset(project_path, file_path)` | `git reset HEAD {file}` / `git reset` | Unstage specific file or all |
| `checkout_file(project_path, file_path)` | `git checkout -- {file}` | Discard changes in one file |
| `show(project_path, hash)` | `git show {hash}` | Full diff for a commit |
| `show_stat(project_path, hash)` | `git show --stat --format=... {hash}` | Changed files in a commit with stats |

### Method Signatures

```python
def add(self, project_path: str, file_path: str | None = None) -> dict:
    """Stage a single file (file_path given) or all changes (file_path None)."""

def reset(self, project_path: str, file_path: str | None = None) -> dict:
    """Unstage a single file or all staged changes."""

def checkout_file(self, project_path: str, file_path: str) -> dict:
    """Discard working tree changes for a single file."""

def show(self, project_path: str, hash: str) -> dict:
    """Return full diff for a commit."""

def show_stat(self, project_path: str, hash: str) -> dict:
    """Return list of changed files in a commit with additions/deletions."""
```

## Frontend API Additions

Added to the `git` namespace in `frontend/src/lib/api.ts`:

```typescript
add(project_path: string, file_path?: string): Promise<ApiResponse>
reset(project_path: string, file_path?: string): Promise<ApiResponse>
checkout_file(project_path: string, file_path: string): Promise<ApiResponse>
show(project_path: string, hash: string): Promise<ApiResponse>
show_stat(project_path: string, hash: string): Promise<ApiResponse>
```

Mock implementations return empty/placeholder data for standalone frontend dev.

## Type Additions

Added to `frontend/src/lib/types.ts`:

```typescript
export interface GitFileChange {
  path: string
  status: string        // "?", "M", "A", "D", etc.
  staged: boolean
}

export interface GitCommitDetail {
  hash: string
  author: string
  email: string
  timestamp: number
  message: string
  files: GitCommitFile[]
}

export interface GitCommitFile {
  path: string
  status: string        // "M", "A", "D", "R"
  additions: number
  deletions: number
}
```

Keep existing `GitFileStatus` and `GitCommit` types for backward compat.

## useGitStore

```typescript
interface GitStore {
  // State
  branch: string
  branches: string[]
  files: GitFileChange[]
  commits: GitCommit[]
  commitHasMore: boolean
  diffContent: string
  diffTitle: string
  activeTab: 'changes' | 'history'
  loading: boolean

  // Core
  refreshAll(projectPath: string): Promise<void>
  setActiveTab(tab: 'changes' | 'history'): void

  // Changes operations
  stageFile(projectPath: string, filePath: string): Promise<void>
  stageAll(projectPath: string): Promise<void>
  unstageFile(projectPath: string, filePath: string): Promise<void>
  unstageAll(projectPath: string): Promise<void>
  discardFile(projectPath: string, filePath: string): Promise<void>
  viewFileDiff(projectPath: string, filePath: string, staged: boolean): Promise<void>

  // Commit
  commit(projectPath: string, message: string): Promise<void>

  // History operations
  loadMoreCommits(projectPath: string): Promise<void>
  viewCommitDiff(projectPath: string, hash: string): Promise<void>
  copyHash(hash: string): void

  // Branch
  switchBranch(projectPath: string, branch: string): Promise<void>

  // Diff
  clearDiff(): void
}
```

All async actions call the API and then refresh relevant state. For example, `stageFile` calls `api.git.add()`, then calls `refreshAll()` to get updated file list.

`commitHasMore` tracks whether more commits exist beyond the loaded batch (initial 20, then +20 each scroll-to-bottom).

## UI Components

### BranchSelector

- Top of left panel
- Shows current branch name with dropdown icon
- Click opens a dropdown listing all branches (current branch marked)
- Click a branch → `switchBranch()` → refresh all

### ChangesPanel

Three file groups:
1. **已暂存** (Staged) — files with `staged: true`
2. **未暂存** (Unstaged) — modified files with `staged: false`
3. **未跟踪** (Untracked) — files with `status: "?"`

Each file row:
- Status icon (color-coded: yellow=M, red=D, green=A, gray=?)
- File name (click → `viewFileDiff()`)
- Action icons per group:
  - Staged: [-] unstage button
  - Unstaged: [+] stage button, [↩] discard button
  - Untracked: [+] stage button

Group headers have bulk action buttons:
- Staged header: "取消全部暂存" → `unstageAll()`
- Unstaged header: "全部暂存" → `stageAll()`

### HistoryPanel

Commit list where each row shows:
- Commit hash (abbreviated 7 chars, click → `copyHash()`)
- Commit message (first line)
- Author name
- Relative time (e.g. "3小时前")

Click a commit → expand inline to show changed files:
- File path + status badge + additions/deletions count
- Click a file → `viewCommitDiff()` to show diff on right

Scroll to bottom triggers `loadMoreCommits()` if `commitHasMore` is true.

### CommitBox

Always visible at bottom of left panel (shared across both tabs):
- Textarea for commit message
- Submit button (disabled when no staged files or empty message)
- On commit → `commit()` → refresh all state

### DiffPanel (right side)

- Shows diff title (file path or commit hash)
- Monospace pre-formatted diff content
- Empty state when nothing selected: "选择文件或提交查看变更"

## Error Handling

- API errors displayed as toast/notification (consistent with existing pattern)
- Destructive actions (discard, switch branch) should have confirmation
- Network/timeout errors handled gracefully with retry option

## Style

- Follows existing Tailwind + shadcn/ui patterns
- Chinese UI strings
- Color coding: staged=green, modified=yellow, deleted=red, untracked=gray
- Consistent with existing panel styling (`border-panel-border`, `bg-panel-bg`, etc.)
