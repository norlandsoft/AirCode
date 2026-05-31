# AirCode — Python + PyWebView Architecture Design

**Date:** 2026-05-31
**Status:** Approved
**Stack:** Python 3.12 + PyWebView + Vite + React + Monaco Editor

## Overview

AirCode is a local Mac desktop development workstation. This design covers a full rewrite from Electron+React+TypeScript to Python+PyWebView, keeping the same core features: code editing, terminal, file management, and project workspace management.

Architecture: **Thin backend + Heavy frontend** — Python handles system capabilities (file I/O, PTY, process management), React handles all UI state and rendering. Communication via `pywebview.api` bridge.

## Architecture

```
┌─────────────────────────────────────────────┐
│                  PyWebView Window            │
│                                             │
│  ┌────────────────────────────────────────┐ │
│  │         React Frontend (Vite)          │ │
│  │                                        │ │
│  │  ┌──────────┐ ┌─────────┐ ┌────────┐  │ │
│  │  │ Monaco   │ │ xterm.js│ │ File   │  │ │
│  │  │ Editor   │ │Terminal │ │ Tree   │  │ │
│  │  └──────────┘ └─────────┘ └────────┘  │ │
│  │                                        │ │
│  │  zustand stores ← window.pywebview.api │ │
│  └────────────────┬───────────────────────┘ │
│                   │ JS ↔ Python bridge      │
│  ┌────────────────▼───────────────────────┐ │
│  │         Python Backend                 │ │
│  │                                        │ │
│  │  Api  ──→  Modules  ──→  System APIs   │ │
│  │  (expose   (file,       (os, pty,      │ │
│  │   to JS)   term, ftp)    subprocess)   │ │
│  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

## Project Structure

```
aircode/
├── backend/
│   ├── main.py              # Entry: create PyWebView window
│   ├── api/
│   │   ├── __init__.py
│   │   ├── base.py          # Root Api class exposed to frontend
│   │   ├── editor.py        # File read/write, search
│   │   ├── terminal.py      # PTY management
│   │   ├── project.py       # Project/workspace management
│   │   └── ftp.py           # FTP operations (Phase 2)
│   ├── modules/
│   │   └── __init__.py      # Module registration mechanism
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── components/
│   │   │   ├── layout/      # TitleBar, Sidebar, StatusBar
│   │   │   ├── editor/      # Monaco editor wrapper
│   │   │   ├── terminal/    # xterm.js wrapper
│   │   │   ├── file-tree/   # File browser
│   │   │   └── project/     # Project management UI
│   │   ├── stores/          # zustand stores
│   │   ├── modules/         # Module registry & types
│   │   ├── lib/
│   │   │   └── api.ts       # Type-safe API wrapper
│   │   └── styles/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
├── scripts/
│   ├── setup.sh             # Init venv + install deps
│   └── build.sh             # Build frontend + package executable
├── CLAUDE.md
└── Makefile                 # make dev / make build / make clean
```

## Python Backend API Layer

### Root Api Class

```python
# backend/api/base.py
class Api:
    def __init__(self):
        self.editor = EditorApi()
        self.terminal = TerminalApi()
        self.project = ProjectApi()

    def get_platform(self) -> str: ...
    def get_app_info(self) -> dict: ...
    def open_file_dialog(self) -> str | None: ...
    def open_folder_dialog(self) -> str | None: ...
```

### Module API Conventions

- One class per module, one file per class
- Methods return Python native types (dict/list/str/int/bool/None)
- PyWebView auto-serializes to JSON; frontend receives JS objects
- Method naming: `{verb}_{noun}` — `read_file`, `list_dir`, `create_terminal`
- Error handling: return `{"error": "message"}`, never throw exceptions (PyWebView exception bridging is unreliable)

### Terminal Streaming

Terminal is the only module requiring streaming data. `pywebview.api` only supports request-response, so streaming uses `window.evaluate_js()` to push data to frontend:

```python
class TerminalApi:
    def create(self, cwd: str = None) -> dict:
        """Create PTY, return {id: "term_1"}"""
        # subprocess + os.pty → background thread reads output
        # → window.evaluate_js() pushes to frontend

    def write(self, id: str, data: str) -> None: ...
    def resize(self, id: str, cols: int, rows: int) -> None: ...
    def destroy(self, id: str) -> None: ...
```

Frontend receives data via global callback:
```typescript
window.__aircode_on_terminal_output = (id: string, data: string) => { ... }
```

## React Frontend Architecture

### PyWebView API Wrapper

```typescript
// frontend/src/lib/api.ts
const isPyWebView = 'pywebview' in window

export const api = isPyWebView
  ? window.pywebview.api
  : mockApi  // Dev mode: Vite dev server + mock data
```

Frontend can run independently with `npm run dev` for development, no Python required.

### zustand Stores

| Store | Responsibility |
|-------|---------------|
| `useProjectStore` | Current project path, project list |
| `useEditorStore` | Open files, active tab, dirty state |
| `useTerminalStore` | Terminal sessions |
| `useModuleStore` | Module registration, active module |

### Module System

```typescript
interface AirCodeModule {
  id: string
  name: string
  icon: string
  sidebarItem?: SidebarItemConfig
  statusBarItems?: StatusBarItemConfig
  component: React.ComponentType
}
```

Modules register to store → auto-appear in sidebar + tab bar + status bar.

Phase 1 modules: Editor, Terminal, FileTree, Project
Phase 2 modules: FTP, Services, AI Agent

### Layout

```
┌─ TitleBar ─────────────────────────────────────┐
│ [Project ▾]   [Tab1] [Tab2] [+]               │
├──────┬─────────────────────────────────────────┤
│      │                                         │
│ Side │        Main Content Area                │
│ bar  │   (Editor / Terminal / panel switch)     │
│      │                                         │
│ 📁   │                                         │
│ 🖥️   │                                         │
│ ⚙️   │                                         │
├──────┴─────────────────────────────────────────┤
│ StatusBar: [module status] [encoding] [pos]     │
└────────────────────────────────────────────────┘
```

### Styling

Tailwind CSS + shadcn/ui (new-york style), consistent with previous project.

## Build & Development Workflow

### Virtual Environment

```bash
python3.12 -m venv .venv/aircode
source .venv/aircode/bin/activate
pip install -r backend/requirements.txt
cd frontend && npm install
```

### Makefile Commands

```makefile
make dev        # Parallel: Vite dev server + PyWebView (hot-reload frontend)
make dev:fe     # Frontend only (Vite dev server, mock API)
make dev:be     # Backend only (PyWebView loads built frontend)
make build      # Frontend build → Python package → executable
make clean      # Clean all build artifacts
```

### Development Hot-Reload

PyWebView loads `http://localhost:5173` (Vite dev server) in dev mode. Frontend changes apply instantly. Only Python backend changes require restart.

```python
# backend/main.py
if DEV_MODE:
    webview.create_window('AirCode', 'http://localhost:5173', ...)
else:
    webview.create_window('AirCode', 'frontend/dist/index.html', ...)
```

### Packaging (PyInstaller)

`make build` executes:
1. `cd frontend && npm run build` → outputs to `frontend/dist/`
2. PyInstaller packages: collects `backend/` + `frontend/dist/`
3. Generates macOS `.app` bundle → outputs to `release/`

PyInstaller spec:
- `--windowed` mode (no terminal window)
- `--name AirCode`
- `frontend/dist/` as `datas`
- PyWebView's webview library correctly collected
- Output `.app` bundle for `/Applications`

### Python Dependencies

| Package | Purpose |
|---------|---------|
| `pywebview` | Desktop window + JS-Python bridge |
| `pyinstaller` | Package executable |
| `pywinpty` | Pseudo-terminal (macOS uses built-in pty module) |

## CLAUDE.md Conventions

### Python Backend

- Use `pathlib.Path` for all paths, never `os.path`
- API methods return native types; errors return `{"error": "message"}`, never throw
- One API class per module, method naming `{verb}_{noun}`
- Type annotations on all public methods
- Use `logging` module, never `print`

### React Frontend

- Functional components + TypeScript
- All API calls through `@/lib/api.ts` wrapper, never access `window.pywebview` directly
- One zustand store per concern
- Tailwind CSS first; custom CSS only in `styles/`
- Components organized by module: `components/{module-name}/`

### General

- Code and comments in English; user-facing strings can be Chinese
- IPC naming: `{module}:{action}` (e.g., `terminal:create`)
- Security: no unverified user input, no shell command concatenation
