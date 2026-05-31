# AirCode Local Storage Design

## Overview

Design a unified backend-managed local storage system for AirCode, replacing the current ad-hoc `localStorage` usage with structured JSON files served through the pywebview API bridge. The system handles four categories of data: application preferences, project configurations, workspace state, and secrets/credentials.

## Directory Structure

```
~/.aircode/
├── settings.json                # Global application settings
├── secrets.json                 # Credentials (file permission 0600)
├── projects/
│   ├── <hash>.json              # Per-project config
│   └── ...
└── workspaces/
    ├── <hash>.json              # Per-project workspace state
    └── ...
```

File names use the first 12 characters of the SHA256 hash of the project's absolute path. Each file also stores the original path for reverse lookup.

## File Schemas

### settings.json — Global Application Settings

```json
{
  "version": 1,
  "theme": "dark",
  "fontSize": 16,
  "terminal": {
    "shell": "/bin/zsh",
    "fontSize": 14
  },
  "editor": {
    "tabSize": 2,
    "wordWrap": true,
    "fontSize": 14
  },
  "recentProjects": ["/path/to/project-a", "/path/to/project-b"],
  "window": {
    "width": 1400,
    "height": 900
  }
}
```

All fields are optional — defaults are applied when a field is absent. The `recentProjects` list replaces the current `aircode_projects` localStorage key.

### projects/\<hash\>.json — Per-Project Configuration

```json
{
  "path": "/path/to/project-a",
  "name": "project-a",
  "gitUserName": null,
  "gitUserEmail": null,
  "ignorePatterns": ["node_modules", ".git", "dist"],
  "editorOverrides": {
    "tabSize": 4
  }
}
```

### workspaces/\<hash\>.json — Workspace State

```json
{
  "projectPath": "/path/to/project-a",
  "activeTabId": "tab_123",
  "tabs": [
    {
      "id": "tab_123",
      "type": "editor",
      "filePath": "src/main.ts",
      "title": "main.ts"
    },
    {
      "id": "tab_456",
      "type": "terminal",
      "title": "终端: 1"
    }
  ],
  "drafts": {
    "src/main.ts": "unsaved editor content..."
  }
}
```

Terminal tabs are saved for reference but not restored on restart (PTY processes are gone). Only `editor`, `file_viewer`, and `git` tabs are restored.

### secrets.json — Credentials

```json
{
  "gitTokens": {},
  "sshKeyPath": null,
  "customTokens": {}
}
```

File is created with `os.chmod(path, 0o600)` — readable only by the current user.

## Backend API

### New module: `backend/api/settings.py`

```python
class SettingsApi:
    # Global settings (settings.json)
    get_settings() -> dict
    update_settings(values: dict) -> dict

    # Project config (projects/<hash>.json)
    get_project_config(path: str) -> dict
    update_project_config(path: str, values: dict) -> dict

    # Workspace state (workspaces/<hash>.json)
    get_workspace(path: str) -> dict
    save_workspace(path: str, data: dict) -> dict

    # Secrets (secrets.json)
    get_secrets() -> dict
    update_secrets(values: dict) -> dict

    # Internal
    _hash_path(path: str) -> str       # SHA256[:12]
    _read_json(file: Path) -> dict     # Returns {} if missing
    _write_json(file: Path, data)      # Atomic: write .tmp then rename
```

### Design rules

1. **Atomic writes**: All write operations write to a `.tmp` file first, then `os.rename()` to the target path.
2. **Auto-initialization**: `~/.aircode/`, `projects/`, and `workspaces/` directories are created on first access.
3. **Merge updates**: `update_settings` and `update_project_config` accept partial dicts and perform deep merge — callers don't need to send the full object.
4. **Error handling**: All methods return `{"error": "message"}` on failure, never throw (follows existing project convention).
5. **Integration**: `SettingsApi` is mixed into the existing `Api` class alongside `project`, `editor`, `terminal`, and `git`.

## Frontend Integration

### New store: `useSettingsStore`

```typescript
interface SettingsState {
  settings: AppSettings
  loadSettings: () => Promise<void>
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>

  projectConfigs: Map<string, ProjectConfig>
  loadProjectConfig: (path: string) => Promise<void>
  updateProjectConfig: (path: string, partial: Partial<ProjectConfig>) => Promise<void>

  saveWorkspace: (path: string, data: WorkspaceData) => Promise<void>
  loadWorkspace: (path: string) => Promise<WorkspaceData | null>
}
```

### Migration: useProjectStore

- Remove manual `localStorage` calls (`loadFromStorage`, `saveFromStorage`)
- Replace with `settings.get_settings()` to load `recentProjects`
- Replace with `settings.update_settings({ recentProjects })` to save
- On first run after migration, check for legacy `aircode_projects` key in localStorage and import it into the backend

### Migration: Workspace restore

- On `window.onbeforeunload`, save current tabs + unsaved editor drafts via `save_workspace`
- On app mount in `App.tsx`, load workspace state via `load_workspace`
- Restore `editor`, `file_viewer`, and `git` tabs; skip terminal tabs
- Draft content is loaded into `useEditorStore` with dirty flag set

## Migration Steps

1. **Backend**: Add `backend/api/settings.py` with `SettingsApi` class
2. **Backend**: Mix `SettingsApi` into `backend/api/__init__.py` `Api` class
3. **Frontend**: Add `frontend/src/lib/types.ts` type definitions for all schemas
4. **Frontend**: Add `frontend/src/stores/useSettingsStore.ts`
5. **Frontend**: Migrate `useProjectStore` from localStorage to backend API
6. **Frontend**: Add workspace save/restore to `useTabStore` + `useEditorStore`
7. **Frontend**: Add legacy localStorage migration (one-time import)
8. **Cleanup**: Remove all direct `localStorage` calls from frontend
