# Tab Session Management Design

Date: 2026-05-31

## Problem

The workspace tab management has three issues:

1. **TabBar shows tabs from all projects** — switching projects does not filter the tab bar, showing stale tabs from other projects.
2. **Terminal sessions are destroyed on tab switch** — switching away from a TerminalTab unmounts the component, which detaches the xterm instance. While the PTY process survives, the xterm instance loses its container and buffered output.
3. **Non-terminal tabs lose state on switch** — CodeTab and GitTab unmount on switch, losing Monaco editor cursor position, undo stack, scroll position, and git view state.

## Solution: CSS Hiding

All tabs for the active project are rendered simultaneously in the DOM. Only the active tab is visible; inactive tabs are hidden via `display: none`. This preserves all component state (Monaco instances, xterm instances, scroll positions, etc.) without any serialization/deserialization overhead.

### Design Decisions

- **Why CSS hiding over keep-alive?** Simpler, no extra dependencies, works perfectly with Monaco and xterm.
- **Why CSS hiding over state serialization?** Desktop apps have no memory pressure. Serialization of Monaco state (cursor, undo stack, view state) and xterm buffer is complex and lossy.
- **Terminal close behavior:** Manually closing a terminal tab destroys the PTY session. Only switching tabs keeps it alive.

---

## Changes

### §1 Tab Type: Add `sessionId`

**File:** `frontend/src/lib/types.ts`

Add optional `sessionId` field to `Tab`:

```typescript
export interface Tab {
  id: string;
  type: TabType;
  title: string;
  icon: string;
  projectId: string;
  filePath?: string;
  isDirty?: boolean;
  sessionId?: string; // NEW: for terminal tabs, the PTY session ID
}
```

**Why:** Currently the session ID is encoded in the tab title and parsed back out. Adding a dedicated field makes session cleanup on tab close straightforward.

### §2 TabBar: Project-Scoped Filtering

**File:** `frontend/src/components/workspace/TabBar.tsx`

- Subscribe to `useProjectStore(s => s.activeProjectId)`.
- Filter `tabs` to only include those matching the active project.
- All tab interactions (click, close, drag reorder) operate on this filtered subset.

### §3 Workspace: Multi-Tab Rendering with CSS Hiding

**File:** `frontend/src/components/workspace/Workspace.tsx`

**Current behavior:** Conditionally renders one component based on `activeTab.type`.

**New behavior:**

```tsx
const projectTabs = tabs.filter(t => t.projectId === activeProjectId);

return (
  <div className="flex-1 relative">
    {projectTabs.map(tab => (
      <div
        key={tab.id}
        className="absolute inset-0"
        style={{ display: tab.id === activeTabId ? 'block' : 'none' }}
      >
        {tab.type === 'terminal' && <TerminalTab tab={tab} />}
        {tab.type === 'code' && <CodeTab tab={tab} />}
        {tab.type === 'git' && <GitTab tab={tab} />}
      </div>
    ))}
  </div>
);
```

Each tab component stays mounted. Only the active tab's container is visible. `absolute inset-0` ensures each tab fills the workspace area.

**`ensureGitTab` remains unchanged** — it already creates a git tab per project.

### §4 Terminal Session Cleanup on Tab Close

**File:** `frontend/src/stores/useTabStore.ts`

In `removeTab`, before removing the tab from the array:

```typescript
if (tab.type === 'terminal' && tab.sessionId) {
  const { destroySession } = useTerminalStore.getState();
  destroySession(tab.sessionId);
}
```

This ensures the backend PTY process is killed and the xterm instance is disposed when the user explicitly closes a terminal tab.

### §5 useTabStore: New Selector

**File:** `frontend/src/stores/useTabStore.ts`

Add a `getProjectTabs` selector for convenience:

```typescript
getProjectTabs: (projectId: string) => Tab[];
```

Returns all tabs where `tab.projectId === projectId`.

---

## Files Changed

| File | Change |
|------|--------|
| `frontend/src/lib/types.ts` | Add `sessionId?: string` to `Tab` interface |
| `frontend/src/stores/useTabStore.ts` | Add `getProjectTabs` selector; terminal cleanup in `removeTab` |
| `frontend/src/components/workspace/TabBar.tsx` | Filter tabs by active project |
| `frontend/src/components/workspace/Workspace.tsx` | Render all project tabs with CSS hiding |
| `frontend/src/components/tabs/TerminalTab.tsx` | Save `sessionId` to tab when session is created |

## What Does NOT Change

- Workspace save/restore logic in `App.tsx` — still saves non-terminal tabs on unload.
- Terminal output buffering in `useTerminalStore` — stays as-is.
- Git tab auto-creation logic — `ensureGitTab` works the same.
- Tab ordering (git tabs pushed to end) — unchanged.

## Edge Cases

- **No project selected:** Show empty workspace as before.
- **Empty project (no tabs):** Show "welcome" state.
- **Multiple terminal tabs per project:** Each maintains its own PTY session independently.
- **Closing a code tab with unsaved changes:** The existing `isDirty` check in `removeTab` should still work; the tab's Monaco instance is still in DOM and can be checked.
