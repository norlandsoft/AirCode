# AirCode - CLAUDE.md

- 使用中文回答所有问题

## Project Overview

AirCode is a local Mac desktop development workstation built with Python + PyWebView + React + TypeScript. It integrates code editing, terminal, file management, and Git operations into a single-window two-panel interface.

## Tech Stack

- **Runtime**: Python 3.12 + PyWebView 5.x
- **Frontend**: React 19 + TypeScript 5.x (Vite)
- **Styling**: Tailwind CSS 4.x + shadcn/ui
- **State**: zustand
- **Editor**: Monaco Editor (@monaco-editor/react)
- **Terminal**: xterm.js (@xterm/xterm)
- **Package Manager**: npm (frontend) + pip (backend)

## Architecture

Two-layer architecture:
- **Backend** (`backend/`): Python — PyWebView window, system APIs (file I/O, PTY, git), exposed via `pywebview.api` bridge
- **Frontend** (`frontend/`): React — UI components, zustand stores, all UI state

Communication: `window.pywebview.api` (JS→Python), `window.evaluate_js()` (Python→JS for terminal streaming)

## Layout

Left-right two-panel:
- **Left panel**: Project list (each project = a working directory)
- **Right panel**: Tab workspace with 3 tab types:
  - Code (file tree + Monaco Editor)
  - Terminal (xterm.js + PTY)
  - Git (status/commit/log/diff)

## Commands

```bash
make setup      # Init Python venv + install all deps
make dev        # Start Vite + PyWebView in dev mode
make dev:fe     # Frontend only (mock API)
make dev:be     # Backend only
make build      # Build frontend + package macOS .app
make clean      # Clean all build artifacts
```

## Directory Structure

```
backend/
├── main.py              # Entry point
├── api/
│   ├── base.py          # Root Api class + system dialogs
│   ├── project.py       # Project/directory management
│   ├── editor.py        # File read/write/search
│   ├── terminal.py      # PTY sessions
│   └── git.py           # Git operations
└── requirements.txt

frontend/
├── src/
│   ├── lib/api.ts       # PyWebView bridge + mock API
│   ├── lib/types.ts     # Shared TypeScript types
│   ├── stores/          # zustand stores (project, tab, editor, terminal)
│   ├── components/
│   │   ├── layout/      # TitleBar, StatusBar
│   │   ├── project/     # ProjectList
│   │   ├── workspace/   # TabBar, Workspace
│   │   └── tabs/        # TerminalTab, CodeTab, GitTab
│   └── index.css        # Tailwind + global styles
├── vite.config.ts
└── package.json
```

## Python Backend Conventions

- Use `pathlib.Path` for all paths, never `os.path`
- API methods return native types; errors return `{"error": "message"}`, never throw
- One API class per module, method naming `{verb}_{noun}` (e.g., `read_file`, `list_directory`)
- Type annotations on all public methods
- Use `logging` module, never `print`
- Terminal streaming: `_push_output()` via `window.evaluate_js()`

## React Frontend Conventions

- Functional components + TypeScript
- All backend calls through `@/lib/api.ts` wrapper, never access `window.pywebview` directly
- One zustand store per concern (project, tab, editor, terminal)
- Tailwind CSS utility classes first; custom CSS only in `index.css`
- Components organized by feature: `components/{feature}/`
- Import alias `@/` maps to `frontend/src/`

## General Conventions

- Code and comments in English; user-facing UI strings in Chinese
- Method naming follows `{module}:{action}` pattern
- Security: never execute unverified user input, never concatenate shell commands
- Git 提交信息中不要添加 Co-Authored-By 内容
- Frontend can run independently with mock API for development
- Python runs in `.venv/aircode` virtual environment

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `pywebview` | Desktop window + JS-Python bridge |
| `pyinstaller` | Package macOS .app |
| `@monaco-editor/react` | Code editor component |
| `@xterm/xterm` | Terminal UI |
| `zustand` | State management |
| `lucide-react` | Icons |
| `tailwindcss` | Styling |

## Build Artifacts

- `frontend/dist/` — Built frontend (HTML + JS + CSS)
- `release/AirCode.app` — Packaged macOS application
- `.venv/aircode/` — Python virtual environment
