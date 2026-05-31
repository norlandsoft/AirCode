# Tab Session Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix tab session management so tabs are filtered per-project, terminal sessions persist across tab switches, and all tab state is preserved via CSS hiding.

**Architecture:** Change Workspace from single-tab conditional rendering to rendering all project tabs simultaneously with `display:none` on inactive ones. Filter TabBar to only show current project's tabs. Add `sessionId` to Tab type for clean PTY session destruction on close.

**Tech Stack:** React, Zustand, TypeScript, Tailwind CSS

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `frontend/src/lib/types.ts` | Add `sessionId` field to `Tab` |
| Modify | `frontend/src/stores/useTabStore.ts` | Add `getProjectTabs`, terminal cleanup in `removeTab` |
| Modify | `frontend/src/components/workspace/TabBar.tsx` | Filter tabs by active project |
| Modify | `frontend/src/components/workspace/Workspace.tsx` | Multi-tab CSS hiding render |
| Modify | `frontend/src/components/tabs/TerminalTab.tsx` | Save `sessionId` to tab, remove title-parse session recovery |
| Modify | `frontend/src/components/tabs/CodeTab.tsx` | Accept `tab` prop instead of `tabId` |
| Modify | `frontend/src/components/tabs/GitTab.tsx` | Accept `tab` prop instead of `tabId` |

---

### Task 1: Add `sessionId` to Tab type

**Files:**
- Modify: `frontend/src/lib/types.ts:3-11`

- [ ] **Step 1: Add `sessionId` field to the `Tab` interface**

In `frontend/src/lib/types.ts`, add the optional `sessionId` field:

```typescript
export interface Tab {
  id: string
  type: TabType
  title: string
  icon: string
  projectId: string
  filePath?: string
  isDirty?: boolean
  sessionId?: string
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /opt/AirCode/frontend && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors related to the new field (it's optional, so all existing code is compatible).

---

### Task 2: Add `getProjectTabs` selector and terminal cleanup to useTabStore

**Files:**
- Modify: `frontend/src/stores/useTabStore.ts`

- [ ] **Step 1: Import useTerminalStore at the top of useTabStore**

Add this import at the top of `frontend/src/stores/useTabStore.ts`:

```typescript
import { useTerminalStore } from "@/stores/useTerminalStore"
```

- [ ] **Step 2: Add `getProjectTabs` to the `TabState` interface**

In the `TabState` interface (line 4), add:

```typescript
getProjectTabs: (projectId: string) => Tab[]
```

- [ ] **Step 3: Implement `getProjectTabs` in the store**

Add to the store object (after `ensureGitTab`):

```typescript
getProjectTabs: (projectId: string) => {
  return get().tabs.filter((t) => t.projectId === projectId)
},
```

- [ ] **Step 4: Add terminal session cleanup to `removeTab`**

Replace the existing `removeTab` function (lines 70-82) with:

```typescript
removeTab: (id: string) => {
  const state = get()
  const tab = state.tabs.find((t) => t.id === id)
  // Git tab cannot be closed
  if (tab?.type === "git") return
  // Destroy terminal PTY session when explicitly closing a terminal tab
  if (tab?.type === "terminal" && tab.sessionId) {
    const { destroySession } = useTerminalStore.getState()
    destroySession(tab.sessionId)
  }
  set((state) => {
    const tabs = state.tabs.filter((t) => t.id !== id)
    const activeTabId =
      state.activeTabId === id
        ? tabs[tabs.length - 1]?.id || null
        : state.activeTabId
    return { tabs, activeTabId }
  })
},
```

Note: The terminal cleanup happens **before** the `set()` call, outside it. This is important because `destroySession` is async but we don't need to await it — the PTY process cleanup can happen asynchronously.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd /opt/AirCode/frontend && npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors.

---

### Task 3: Filter TabBar by active project

**Files:**
- Modify: `frontend/src/components/workspace/TabBar.tsx`

- [ ] **Step 1: Replace the `tabs` subscription with a project-filtered version**

In `frontend/src/components/workspace/TabBar.tsx`, the `activeProjectId` is already subscribed (line 18). Replace line 13:

```typescript
// BEFORE:
const tabs = useTabStore((s) => s.tabs)

// AFTER:
const activeProjectId = useProjectStore((s) => s.activeProjectId)
const tabs = useTabStore((s) =>
  s.tabs.filter((t) => t.projectId === activeProjectId)
)
```

Note: `activeProjectId` is already declared on line 18, so remove the duplicate declaration. The filtered `tabs` is derived inline in the selector.

- [ ] **Step 2: Verify TabBar compiles**

Run: `cd /opt/AirCode/frontend && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors.

---

### Task 4: Update tab component props to accept `tab` object

Currently all three tab components accept `{ tabId: string }` and look up the tab internally. With CSS hiding, they'll receive the `tab` object directly for clarity.

**Files:**
- Modify: `frontend/src/components/tabs/TerminalTab.tsx`
- Modify: `frontend/src/components/tabs/CodeTab.tsx`
- Modify: `frontend/src/components/tabs/GitTab.tsx`

- [ ] **Step 1: Update TerminalTab props**

In `frontend/src/components/tabs/TerminalTab.tsx`, change the props interface and update internal usage:

Replace lines 9-13:

```typescript
// BEFORE:
interface TerminalTabProps {
  tabId: string
}

export function TerminalTab({ tabId }: TerminalTabProps) {
```

With:

```typescript
import type { Tab } from "@/lib/types"

interface TerminalTabProps {
  tab: Tab
}

export function TerminalTab({ tab }: TerminalTabProps) {
```

Replace all internal references from `tabId` to `tab.id`:
- Line 26: `const updateTab = useTabStore((s) => s.updateTab)` — keep as is
- Line 31-37: Replace the `existingSessionId` selector. Instead of parsing from title, use `tab.sessionId`:

```typescript
const existingSessionId = tab.sessionId || null
```

- Line 52: `updateTab(tabId, { title: ... })` → `updateTab(tab.id, { ... })`
- Line 52: Also save sessionId to tab when creating a new session:

```typescript
updateTab(tab.id, {
  title: `终端: ${session.id.replace("term_", "")}`,
  sessionId: session.id,
})
```

- [ ] **Step 2: Update CodeTab props**

In `frontend/src/components/tabs/CodeTab.tsx`, replace lines 14-15:

```typescript
// BEFORE:
interface CodeTabProps {
  tabId: string
}

export function CodeTab({ tabId }: CodeTabProps) {
```

With:

```typescript
import type { Tab } from "@/lib/types"

interface CodeTabProps {
  tab: Tab
}

export function CodeTab({ tab }: CodeTabProps) {
```

Replace all `tabId` references with `tab.id`:
- Line 64: `updateTab(tabId, { title: fileName, filePath })` → `updateTab(tab.id, { title: fileName, filePath })`
- Line 73: `updateTab(tabId, { isDirty: true })` → `updateTab(tab.id, { isDirty: true })`
- Line 83: `if (ok) updateTab(tabId, { isDirty: false })` → `if (ok) updateTab(tab.id, { isDirty: false })`

- [ ] **Step 3: Update GitTab props**

In `frontend/src/components/tabs/GitTab.tsx`, replace lines 10-11:

```typescript
// BEFORE:
interface GitTabProps {
  tabId: string
}

export function GitTab({ tabId: _tabId }: GitTabProps) {
```

With:

```typescript
import type { Tab } from "@/lib/types"

interface GitTabProps {
  tab: Tab
}

export function GitTab({ tab: _tab }: GitTabProps) {
```

(GitTab doesn't actually use the tabId/tab, so this is a minimal change.)

- [ ] **Step 4: Verify all three compile**

Run: `cd /opt/AirCode/frontend && npx tsc --noEmit 2>&1 | head -20`
Expected: Errors about `tabId` not matching the new `tab` prop — that's expected, will be fixed in Task 5.

---

### Task 5: Rewrite Workspace to use CSS hiding

**Files:**
- Modify: `frontend/src/components/workspace/Workspace.tsx`

- [ ] **Step 1: Rewrite Workspace.tsx**

Replace the entire content of `frontend/src/components/workspace/Workspace.tsx` with:

```tsx
import { useEffect } from "react"
import { TabBar } from "./TabBar"
import { useTabStore } from "@/stores/useTabStore"
import { useProjectStore } from "@/stores/useProjectStore"
import { TerminalTab } from "@/components/tabs/TerminalTab"
import { CodeTab } from "@/components/tabs/CodeTab"
import { GitTab } from "@/components/tabs/GitTab"

export function Workspace() {
  const tabs = useTabStore((s) => s.tabs)
  const activeTabId = useTabStore((s) => s.activeTabId)
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const ensureGitTab = useTabStore((s) => s.ensureGitTab)

  // When active project changes, ensure git tab exists
  useEffect(() => {
    if (activeProjectId) {
      ensureGitTab(activeProjectId)
    }
  }, [activeProjectId, ensureGitTab])

  // Filter tabs for current project
  const projectTabs = activeProjectId
    ? tabs.filter((t) => t.projectId === activeProjectId)
    : []

  if (!activeProjectId) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex h-full items-center justify-center text-text-muted">
          <div className="text-center">
            <p className="text-lg">欢迎使用 AirCode</p>
            <p className="mt-2 text-sm">请在左侧面板添加一个项目目录开始使用</p>
          </div>
        </div>
      </div>
    )
  }

  const hasActiveTab = projectTabs.some((t) => t.id === activeTabId)

  return (
    <div className="flex h-full flex-col">
      <TabBar />
      <div className="flex-1 relative">
        {/* Empty state when no active tab */}
        {!hasActiveTab && (
          <div className="absolute inset-0 flex items-center justify-center text-text-muted">
            <div className="text-center">
              <p>点击 + 创建标签页</p>
              <p className="mt-1 text-xs">代码 / 终端</p>
            </div>
          </div>
        )}
        {/* Render all project tabs, hide inactive ones via CSS */}
        {projectTabs.map((tab) => (
          <div
            key={tab.id}
            className="absolute inset-0"
            style={{ display: tab.id === activeTabId ? "block" : "none" }}
          >
            {tab.type === "terminal" && <TerminalTab tab={tab} />}
            {tab.type === "code" && <CodeTab tab={tab} />}
            {tab.type === "git" && <GitTab tab={tab} />}
          </div>
        ))}
      </div>
    </div>
  )
}
```

Key changes from original:
1. Removed `activeTab` single-tab lookup
2. Added `projectTabs` filtering by `activeProjectId`
3. Changed workspace body to `relative` container with `absolute inset-0` tab wrappers
4. All project tabs render simultaneously; only active one has `display: block`
5. Components receive `tab` object instead of `tabId`

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /opt/AirCode/frontend && npx tsc --noEmit 2>&1 | head -20`
Expected: Clean compile with no errors.

---

### Task 6: Verify the full build

- [ ] **Step 1: Run Vite build to confirm no errors**

Run: `cd /opt/AirCode/frontend && npm run build 2>&1 | tail -10`
Expected: Build succeeds.

- [ ] **Step 2: Commit all changes**

```bash
cd /opt/AirCode
git add frontend/src/lib/types.ts frontend/src/stores/useTabStore.ts frontend/src/components/workspace/TabBar.tsx frontend/src/components/workspace/Workspace.tsx frontend/src/components/tabs/TerminalTab.tsx frontend/src/components/tabs/CodeTab.tsx frontend/src/components/tabs/GitTab.tsx
git commit -m "feat: project-scoped tabs with CSS hiding for session persistence"
```

---

## Verification Checklist

After implementation, manually verify:

1. **Project filtering:** Select project A (has tabs), then project B. TabBar should only show project B's tabs. Switch back to A — A's tabs reappear.
2. **Terminal persistence:** Open a terminal tab, run a long-running command (e.g. `top`). Switch to code tab. Switch back to terminal. The command output should still be visible and interactive.
3. **Code state:** Open a file, scroll down, type some text. Switch to terminal tab. Switch back. Cursor position, scroll, and undo stack should be intact.
4. **Terminal close:** Close a terminal tab. The PTY process should be killed (verify with `ps`).
5. **Git tab auto-create:** Select a project — git tab should appear automatically.
