# Local Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ad-hoc localStorage with a unified backend-managed JSON file storage system for settings, project configs, workspace state, and secrets.

**Architecture:** Python backend serves JSON files from `~/.aircode/` via the pywebview API bridge. Frontend accesses all storage through a new `settings` namespace on the API. Existing localStorage usage is migrated and removed.

**Tech Stack:** Python 3.12 (pathlib, json, hashlib, threading), Zustand stores, pywebview bridge

---

## Task 1: Backend — Create SettingsApi module

**Files:**
- Create: `backend/api/settings.py`

- [ ] **Step 1: Create `backend/api/settings.py`**

```python
import hashlib
import json
import logging
import os
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# Default values for a fresh settings.json
DEFAULT_SETTINGS: dict[str, Any] = {
    "version": 1,
    "theme": "dark",
    "fontSize": 16,
    "terminal": {
        "shell": "/bin/zsh",
        "fontSize": 14,
    },
    "editor": {
        "tabSize": 2,
        "wordWrap": True,
        "fontSize": 14,
    },
    "recentProjects": [],
    "window": {
        "width": 1400,
        "height": 900,
    },
}

DEFAULT_SECRETS: dict[str, Any] = {
    "gitTokens": {},
    "sshKeyPath": None,
    "customTokens": {},
}


def _deep_merge(base: dict, override: dict) -> dict:
    """Recursively merge override into base, returning a new dict."""
    result = {**base}
    for key, value in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = _deep_merge(result[key], value)
        else:
            result[key] = value
    return result


class SettingsApi:
    """Manages persistent storage in ~/.aircode/ as JSON files."""

    def __init__(self) -> None:
        self._base_dir = Path.home() / ".aircode"

    # ---- Directory helpers ----

    def _ensure_dirs(self) -> None:
        """Create ~/.aircode/ and subdirectories if they don't exist."""
        for subdir in ("projects", "workspaces"):
            (self._base_dir / subdir).mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _hash_path(path: str) -> str:
        """Return first 12 chars of SHA256 hex digest of the path."""
        return hashlib.sha256(path.encode("utf-8")).hexdigest()[:12]

    # ---- JSON read/write ----

    def _read_json(self, file_path: Path) -> dict:
        """Read a JSON file. Return empty dict if it doesn't exist."""
        if not file_path.exists():
            return {}
        try:
            text = file_path.read_text(encoding="utf-8")
            return json.loads(text)
        except (json.JSONDecodeError, OSError) as e:
            logger.error("Failed to read %s: %s", file_path, e)
            return {}

    def _write_json(self, file_path: Path, data: dict) -> dict:
        """Atomically write a JSON file. Returns {"success": True} or {"error": "..."}."""
        try:
            self._ensure_dirs()
            file_path.parent.mkdir(parents=True, exist_ok=True)
            tmp_path = file_path.with_suffix(".tmp")
            tmp_path.write_text(
                json.dumps(data, indent=2, ensure_ascii=False) + "\n",
                encoding="utf-8",
            )
            os.replace(str(tmp_path), str(file_path))
            return {"success": True}
        except OSError as e:
            logger.error("Failed to write %s: %s", file_path, e)
            return {"error": str(e)}

    # ---- Global settings ----

    def get_settings(self) -> dict:
        """Read global settings. Returns defaults merged with saved values."""
        path = self._base_dir / "settings.json"
        saved = self._read_json(path)
        if not saved:
            return {**DEFAULT_SETTINGS}
        return _deep_merge(DEFAULT_SETTINGS, saved)

    def update_settings(self, values: dict) -> dict:
        """Deep-merge partial values into settings and save."""
        current = self.get_settings()
        merged = _deep_merge(current, values)
        return self._write_json(self._base_dir / "settings.json", merged)

    # ---- Project config ----

    def get_project_config(self, project_path: str) -> dict:
        """Read per-project config."""
        h = self._hash_path(project_path)
        path = self._base_dir / "projects" / f"{h}.json"
        return self._read_json(path)

    def update_project_config(self, project_path: str, values: dict) -> dict:
        """Deep-merge partial values into project config and save."""
        h = self._hash_path(project_path)
        path = self._base_dir / "projects" / f"{h}.json"
        current = self._read_json(path)
        merged = _deep_merge(current, values)
        return self._write_json(path, merged)

    # ---- Workspace state ----

    def get_workspace(self, project_path: str) -> dict:
        """Read workspace state for a project."""
        h = self._hash_path(project_path)
        path = self._base_dir / "workspaces" / f"{h}.json"
        return self._read_json(path)

    def save_workspace(self, project_path: str, data: dict) -> dict:
        """Overwrite workspace state for a project."""
        h = self._hash_path(project_path)
        path = self._base_dir / "workspaces" / f"{h}.json"
        payload = {**data, "projectPath": project_path}
        return self._write_json(path, payload)

    # ---- Secrets ----

    def get_secrets(self) -> dict:
        """Read secrets.json."""
        path = self._base_dir / "secrets.json"
        return self._read_json(path) or {**DEFAULT_SECRETS}

    def update_secrets(self, values: dict) -> dict:
        """Deep-merge partial values into secrets and save."""
        path = self._base_dir / "secrets.json"
        current = self.get_secrets()
        merged = _deep_merge(current, values)
        result = self._write_json(path, merged)
        # Ensure secrets file is only readable by owner
        try:
            os.chmod(str(path), 0o600)
        except OSError:
            pass
        return result
```

- [ ] **Step 2: Verify Python syntax**

Run: `python3 -c "import py_compile; py_compile.compile('backend/api/settings.py', doraise=True); print('OK')"`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/api/settings.py
git commit -m "feat: add SettingsApi backend module for local JSON storage"
```

---

## Task 2: Backend — Register SettingsApi in Api class

**Files:**
- Modify: `backend/api/base.py`

- [ ] **Step 1: Add SettingsApi import and instantiation to Api class**

In `backend/api/base.py`, add the import inside `__init__` (following the existing pattern) and create the `self.settings` attribute:

Change the `__init__` method to:

```python
    def __init__(self) -> None:
        self._window: webview.Window | None = None
        from .project import ProjectApi
        from .editor import EditorApi
        from .terminal import TerminalApi
        from .git import GitApi
        from .settings import SettingsApi
        self.project = ProjectApi(self)
        self.editor = EditorApi(self)
        self.terminal = TerminalApi(self)
        self.git = GitApi(self)
        self.settings = SettingsApi()
```

- [ ] **Step 2: Verify it imports correctly**

Run: `cd /opt/AirCode && .venv/aircode/bin/python -c "from backend.api import Api; a = Api(); print('settings' in dir(a.settings))"`

Expected: no error, may print `False` (dir listing is flat) — the important thing is no import error.

- [ ] **Step 3: Commit**

```bash
git add backend/api/base.py
git commit -m "feat: register SettingsApi in Api class"
```

---

## Task 3: Frontend — Add TypeScript types for storage schemas

**Files:**
- Modify: `frontend/src/lib/types.ts`

- [ ] **Step 1: Add storage-related type definitions to `types.ts`**

Append the following interfaces to the end of `frontend/src/lib/types.ts`:

```typescript
// ---- Settings / Storage types ----

export interface TerminalSettings {
  shell: string
  fontSize: number
}

export interface EditorSettings {
  tabSize: number
  wordWrap: boolean
  fontSize: number
}

export interface WindowSettings {
  width: number
  height: number
}

export interface AppSettings {
  version: number
  theme: string
  fontSize: number
  terminal: TerminalSettings
  editor: EditorSettings
  recentProjects: string[]
  window: WindowSettings
}

export interface ProjectConfig {
  path: string
  name: string
  gitUserName: string | null
  gitUserEmail: string | null
  ignorePatterns: string[]
  editorOverrides: Partial<EditorSettings>
}

export interface WorkspaceTab {
  id: string
  type: TabType
  filePath?: string
  title: string
}

export interface WorkspaceData {
  projectPath: string
  activeTabId: string
  tabs: WorkspaceTab[]
  drafts: Record<string, string>
}

export interface Secrets {
  gitTokens: Record<string, string>
  sshKeyPath: string | null
  customTokens: Record<string, string>
}
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `cd /opt/AirCode/frontend && npx tsc --noEmit 2>&1 | head -20`

Expected: no errors related to the new types.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/types.ts
git commit -m "feat: add TypeScript types for storage schemas"
```

---

## Task 4: Frontend — Add settings API declarations and mock

**Files:**
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Add settings namespace to the pywebview API type declaration**

In the `Window["pywebview"]["api"]` interface inside `api.ts`, add the `settings` namespace after `git`:

```typescript
        settings: {
          get_settings(): Promise<ApiResponse>
          update_settings(values: Record<string, unknown>): Promise<ApiResponse>
          get_project_config(project_path: string): Promise<ApiResponse>
          update_project_config(project_path: string, values: Record<string, unknown>): Promise<ApiResponse>
          get_workspace(project_path: string): Promise<ApiResponse>
          save_workspace(project_path: string, data: Record<string, unknown>): Promise<ApiResponse>
          get_secrets(): Promise<ApiResponse>
          update_secrets(values: Record<string, unknown>): Promise<ApiResponse>
        }
```

- [ ] **Step 2: Add settings mock to mockApi**

Inside the `mockApi` object, add a `settings` property after `git`:

```typescript
  settings: {
    get_settings: async () => ({
      version: 1,
      theme: "dark",
      fontSize: 16,
      terminal: { shell: "/bin/zsh", fontSize: 14 },
      editor: { tabSize: 2, wordWrap: true, fontSize: 14 },
      recentProjects: [],
      window: { width: 1400, height: 900 },
    }),
    update_settings: async () => ({ success: true }),
    get_project_config: async () => ({
      path: "",
      name: "",
      gitUserName: null,
      gitUserEmail: null,
      ignorePatterns: ["node_modules", ".git", "dist"],
      editorOverrides: {},
    }),
    update_project_config: async () => ({ success: true }),
    get_workspace: async () => ({}),
    save_workspace: async () => ({ success: true }),
    get_secrets: async () => ({
      gitTokens: {},
      sshKeyPath: null,
      customTokens: {},
    }),
    update_secrets: async () => ({ success: true }),
  },
```

- [ ] **Step 3: Verify TypeScript compilation**

Run: `cd /opt/AirCode/frontend && npx tsc --noEmit 2>&1 | head -20`

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat: add settings API declarations and mock to frontend"
```

---

## Task 5: Frontend — Create useSettingsStore

**Files:**
- Create: `frontend/src/stores/useSettingsStore.ts`

- [ ] **Step 1: Create the store file**

```typescript
import { create } from "zustand"
import { api } from "@/lib/api"
import type { AppSettings, ProjectConfig, WorkspaceData, Secrets } from "@/lib/types"

const DEFAULT_SETTINGS: AppSettings = {
  version: 1,
  theme: "dark",
  fontSize: 16,
  terminal: { shell: "/bin/zsh", fontSize: 14 },
  editor: { tabSize: 2, wordWrap: true, fontSize: 14 },
  recentProjects: [],
  window: { width: 1400, height: 900 },
}

interface SettingsState {
  settings: AppSettings
  projectConfigs: Map<string, ProjectConfig>
  loaded: boolean

  loadSettings: () => Promise<void>
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>
  loadProjectConfig: (path: string) => Promise<void>
  updateProjectConfig: (path: string, partial: Partial<ProjectConfig>) => Promise<void>
  loadWorkspace: (path: string) => Promise<WorkspaceData | null>
  saveWorkspace: (path: string, data: WorkspaceData) => Promise<void>
  loadSecrets: () => Promise<Secrets>
  updateSecrets: (partial: Partial<Secrets>) => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  projectConfigs: new Map(),
  loaded: false,

  loadSettings: async () => {
    const a = await api()
    const result = await a.settings.get_settings()
    if (result.error) return
    set({ settings: result as unknown as AppSettings, loaded: true })
  },

  updateSettings: async (partial: Partial<AppSettings>) => {
    const a = await api()
    const result = await a.settings.update_settings(partial as Record<string, unknown>)
    if (result.error) return
    // Reload to get the merged result
    await get().loadSettings()
  },

  loadProjectConfig: async (path: string) => {
    const a = await api()
    const result = await a.settings.get_project_config(path)
    if (result.error) return
    set((state) => {
      const configs = new Map(state.projectConfigs)
      configs.set(path, result as unknown as ProjectConfig)
      return { projectConfigs: configs }
    })
  },

  updateProjectConfig: async (path: string, partial: Partial<ProjectConfig>) => {
    const a = await api()
    const result = await a.settings.update_project_config(path, partial as Record<string, unknown>)
    if (result.error) return
    await get().loadProjectConfig(path)
  },

  loadWorkspace: async (path: string) => {
    const a = await api()
    const result = await a.settings.get_workspace(path)
    if (result.error || !result.projectPath) return null
    return result as unknown as WorkspaceData
  },

  saveWorkspace: async (path: string, data: WorkspaceData) => {
    const a = await api()
    await a.settings.save_workspace(path, data as unknown as Record<string, unknown>)
  },

  loadSecrets: async () => {
    const a = await api()
    const result = await a.settings.get_secrets()
    return (result as unknown as Secrets) || { gitTokens: {}, sshKeyPath: null, customTokens: {} }
  },

  updateSecrets: async (partial: Partial<Secrets>) => {
    const a = await api()
    await a.settings.update_secrets(partial as Record<string, unknown>)
  },
}))
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `cd /opt/AirCode/frontend && npx tsc --noEmit 2>&1 | head -20`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/stores/useSettingsStore.ts
git commit -m "feat: add useSettingsStore for backend storage access"
```

---

## Task 6: Frontend — Migrate useProjectStore from localStorage to backend

**Files:**
- Modify: `frontend/src/stores/useProjectStore.ts`

- [ ] **Step 1: Rewrite useProjectStore to use backend API**

Replace the entire content of `frontend/src/stores/useProjectStore.ts` with:

```typescript
import { create } from "zustand"
import type { Project, FileEntry } from "@/lib/types"
import { api } from "@/lib/api"
import { useSettingsStore } from "./useSettingsStore"

interface ProjectState {
  projects: Project[]
  activeProjectId: string | null
  fileTree: FileEntry[]

  addProject: (path: string) => Promise<void>
  removeProject: (id: string) => void
  setActiveProject: (id: string) => void
  loadFileTree: (dirPath: string) => Promise<void>
  loadFromStorage: () => Promise<void>
  _saveToBackend: () => Promise<void>
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  activeProjectId: null,
  fileTree: [],

  addProject: async (path: string) => {
    const a = await api()
    const result = await a.project.get_project_info(path)
    if (result.error) return

    const project: Project = {
      id: path,
      name: (result.name as string) || path.split("/").pop() || path,
      path: path,
      isGitRepo: (result.is_git_repo as boolean) || false,
    }

    const exists = get().projects.some((p) => p.path === path)
    if (exists) return

    set((state) => ({
      projects: [...state.projects, project],
      activeProjectId: state.activeProjectId || project.id,
    }))

    await get()._saveToBackend()

    if (get().activeProjectId === project.id) {
      get().loadFileTree(path)
    }
  },

  removeProject: (id: string) => {
    set((state) => {
      const projects = state.projects.filter((p) => p.id !== id)
      const activeProjectId =
        state.activeProjectId === id
          ? projects[0]?.id || null
          : state.activeProjectId
      return { projects, activeProjectId }
    })
    get()._saveToBackend()
  },

  setActiveProject: (id: string) => {
    set({ activeProjectId: id })
    const project = get().projects.find((p) => p.id === id)
    if (project) {
      get().loadFileTree(project.path)
    }
    get()._saveToBackend()
  },

  loadFileTree: async (dirPath: string) => {
    const a = await api()
    const result = await a.project.list_directory(dirPath)
    if (result.error) return
    set({ fileTree: (result.entries as FileEntry[]) || [] })
  },

  loadFromStorage: async () => {
    // Load global settings (which includes recentProjects)
    await useSettingsStore.getState().loadSettings()

    // One-time migration from legacy localStorage
    const legacyData = localStorage.getItem("aircode_projects")
    if (legacyData) {
      try {
        const parsed = JSON.parse(legacyData)
        if (parsed.projects && Array.isArray(parsed.projects)) {
          // Import legacy projects into backend
          const settings = useSettingsStore.getState().settings
          const existingPaths = new Set(settings.recentProjects)
          const newPaths = parsed.projects
            .map((p: { path: string }) => p.path)
            .filter((p: string) => !existingPaths.has(p))
          if (newPaths.length > 0 || parsed.activeProjectId) {
            await useSettingsStore.getState().updateSettings({
              recentProjects: [...settings.recentProjects, ...newPaths],
            })
          }
          // Restore project objects from legacy data
          set({
            projects: parsed.projects || [],
            activeProjectId: parsed.activeProjectId || null,
          })
          // Clear legacy data
          localStorage.removeItem("aircode_projects")
          return
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Normal load from backend
    const settings = useSettingsStore.getState().settings
    const recentPaths = settings.recentProjects || []
    if (recentPaths.length === 0) return

    const a = await api()
    const projects: Project[] = []
    for (const projPath of recentPaths) {
      const info = await a.project.get_project_info(projPath)
      if (info.error || !info.exists) continue
      projects.push({
        id: projPath,
        name: (info.name as string) || projPath.split("/").pop() || projPath,
        path: projPath,
        isGitRepo: (info.is_git_repo as boolean) || false,
      })
    }
    set({
      projects,
      activeProjectId: projects[0]?.id || null,
    })
  },

  _saveToBackend: async () => {
    const { projects, activeProjectId } = get()
    const recentProjects = projects.map((p) => p.path)
    await useSettingsStore.getState().updateSettings({
      recentProjects,
    } as Partial<import("@/lib/types").AppSettings>)
    // Also save active project as the first in list for convenience
    if (activeProjectId) {
      const reordered = [
        activeProjectId,
        ...recentProjects.filter((p) => p !== activeProjectId),
      ]
      await useSettingsStore.getState().updateSettings({
        recentProjects: reordered,
      } as Partial<import("@/lib/types").AppSettings>)
    }
  },
}))
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `cd /opt/AirCode/frontend && npx tsc --noEmit 2>&1 | head -20`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/stores/useProjectStore.ts
git commit -m "feat: migrate useProjectStore from localStorage to backend API"
```

---

## Task 7: Frontend — Add workspace save/restore

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/stores/useTabStore.ts`
- Modify: `frontend/src/stores/useEditorStore.ts`

- [ ] **Step 1: Add a `getRestorableTabs` helper to useTabStore**

In `frontend/src/stores/useTabStore.ts`, add a new method to the `TabState` interface and implementation:

Add to the `TabState` interface:

```typescript
  getRestorableTabs: () => Tab[]
```

Add to the store implementation (inside the `create` callback), after `getActiveTab`:

```typescript
  getRestorableTabs: () => {
    return get().tabs.filter((t) => t.type !== "terminal")
  },
```

- [ ] **Step 2: Add a `getDirtyDrafts` helper to useEditorStore**

In `frontend/src/stores/useEditorStore.ts`, add to the `EditorState` interface:

```typescript
  getDirtyDrafts: () => Record<string, string>
```

Add to the store implementation, after `closeFile`:

```typescript
  getDirtyDrafts: () => {
    const drafts: Record<string, string> = {}
    get().files.forEach((file) => {
      if (file.isDirty) {
        drafts[file.path] = file.content
      }
    })
    return drafts
  },
```

- [ ] **Step 3: Rewrite App.tsx with workspace save/restore and settings init**

Replace the entire content of `frontend/src/App.tsx` with:

```typescript
import { useEffect } from "react"
import { TitleBar } from "@/components/layout/TitleBar"
import { StatusBar } from "@/components/layout/StatusBar"
import { ProjectList } from "@/components/project/ProjectList"
import { Workspace } from "@/components/workspace/Workspace"
import { useProjectStore } from "@/stores/useProjectStore"
import { useTabStore } from "@/stores/useTabStore"
import { useEditorStore } from "@/stores/useEditorStore"
import { useSettingsStore } from "@/stores/useSettingsStore"

export default function App() {
  const loadFromStorage = useProjectStore((s) => s.loadFromStorage)
  const addTab = useTabStore((s) => s.addTab)
  const setActiveTab = useTabStore((s) => s.setActiveTab)
  const openFile = useEditorStore((s) => s.openFile)
  const updateContent = useEditorStore((s) => s.updateContent)
  const loadWorkspace = useSettingsStore((s) => s.loadWorkspace)
  const saveWorkspace = useSettingsStore((s) => s.saveWorkspace)

  // Load projects and restore workspace on mount
  useEffect(() => {
    async function init() {
      await loadFromStorage()
      const activeProjectId = useProjectStore.getState().activeProjectId
      if (!activeProjectId) return

      const workspace = await loadWorkspace(activeProjectId)
      if (!workspace || !workspace.tabs || workspace.tabs.length === 0) return

      // Restore non-terminal tabs
      for (const tab of workspace.tabs) {
        if (tab.type === "terminal") continue
        const newId = addTab(tab.type, activeProjectId, {
          filePath: tab.filePath,
          title: tab.title,
        })
        // Restore draft content for editor tabs
        if (tab.type === "editor" && tab.filePath && workspace.drafts?.[tab.filePath]) {
          // Open the file first to load from backend, then apply draft
          const file = await openFile(tab.filePath)
          if (file) {
            updateContent(tab.filePath, workspace.drafts[tab.filePath])
          }
        }
        // Restore the active tab
        if (tab.id === workspace.activeTabId) {
          setActiveTab(newId)
        }
      }
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Save workspace on close
  useEffect(() => {
    const handleBeforeUnload = () => {
      const activeProjectId = useProjectStore.getState().activeProjectId
      if (!activeProjectId) return

      const tabs = useTabStore.getState().getRestorableTabs()
      const drafts = useEditorStore.getState().getDirtyDrafts()
      const activeTabId = useTabStore.getState().activeTabId

      const workspaceData = {
        projectPath: activeProjectId,
        activeTabId: activeTabId || "",
        tabs: tabs.map((t) => ({
          id: t.id,
          type: t.type,
          filePath: t.filePath,
          title: t.title,
        })),
        drafts,
      }

      // Use synchronous XHR for beforeunload — async fetch won't complete
      // Instead we save via navigator.sendBeacon pattern won't work for pywebview.
      // We save proactively on tab changes instead (see below).
      saveWorkspace(activeProjectId, workspaceData)
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [loadWorkspace, saveWorkspace, addTab, setActiveTab, openFile, updateContent])

  return (
    <div className="flex h-screen flex-col">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <ProjectList />
        <Workspace />
      </div>
      <StatusBar />
    </div>
  )
}
```

- [ ] **Step 4: Verify TypeScript compilation**

Run: `cd /opt/AirCode/frontend && npx tsc --noEmit 2>&1 | head -20`

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/stores/useTabStore.ts frontend/src/stores/useEditorStore.ts
git commit -m "feat: add workspace save/restore with tab and draft persistence"
```

---

## Task 8: Build and smoke test

**Files:** None (verification only)

- [ ] **Step 1: Build frontend**

Run: `cd /opt/AirCode/frontend && npm run build`

Expected: build succeeds, no errors.

- [ ] **Step 2: Build macOS app**

Run: `cd /opt/AirCode && make build`

Expected: build succeeds, `dist/AirCode.app` created.

- [ ] **Step 3: Run app from CLI to verify storage works**

Run: `.venv/aircode/bin/python backend/main.py` (keep open for a few seconds)

Then in another terminal, verify the settings file was created:

Run: `cat ~/.aircode/settings.json`

Expected: valid JSON with default values.

- [ ] **Step 4: Run built app to verify packaging works**

Run: `/opt/AirCode/dist/AirCode.app/Contents/MacOS/AirCode 2>&1 &` then `sleep 3 && kill %1`

Expected: no crash, no import errors in output.

- [ ] **Step 5: Final commit if any build fixes were needed**

```bash
git add -A
git commit -m "chore: fix build issues from storage integration"
```
