# AirCode - CLAUDE.md

## Project Overview

AirCode is a local Mac desktop development workstation built with Electron + React + TypeScript. It integrates code editing, terminal, service management, and FTP client into a single-window multi-panel interface.

## Tech Stack

- **Runtime**: Electron 35.x (electron-vite 3.x)
- **Frontend**: React 19 + TypeScript 5.x
- **Build**: electron-vite (Vite-based)
- **Styling**: Tailwind CSS 4.x + shadcn/ui (new-york style)
- **State**: zustand
- **Package Manager**: npm

## Architecture

Three-process Electron architecture:
- **Main** (`src/main/`): Node.js process — IPC handlers, node-pty, basic-ftp, file system, service management
- **Preload** (`src/preload/`): contextBridge API — type-safe IPC bridge with `contextIsolation: true`
- **Renderer** (`src/renderer/`): React app — UI components, zustand stores, module system
- **Shared** (`src/shared/`): TypeScript types shared across all processes

## Module System

All features are implemented as modules conforming to the `AirCodeModule` interface (`src/shared/types/module.ts`). Modules self-register into the `ModuleRegistry` and automatically appear in the sidebar, tab bar, and status bar.

Phase 1 modules: Editor, Terminal, FTP, Services.
Future modules: AI Agent, CI/CD, Web Browser, Chat.

## IPC Pattern

- Request/response: `ipcMain.handle` / `ipcRenderer.invoke` (Promise-based)
- Streaming data (terminal output, logs): `webContents.send` / `ipcRenderer.on`
- All IPC channel names follow `{module}:{action}` convention (e.g., `terminal:create`, `ftp:list`)

## Commands

```bash
npm run dev          # Start dev server with HMR
npm run build        # Production build (main + preload + renderer)
npm run build:mac    # Build and package for macOS
```

## Conventions

- **Language**: All code and comments in English. User-facing strings can be Chinese.
- **Imports**: Use `@/` alias for renderer imports (configured in electron.vite.config.ts and tsconfig.web.json).
- **Types**: Shared types go in `src/shared/types/`. Never duplicate type definitions across processes.
- **Styling**: Use Tailwind utility classes. Custom CSS only in `src/renderer/styles.css` for global resets and CSS variables.
- **State**: zustand stores in `src/renderer/stores/`. One store per concern.
- **Components**: Functional React components. Follow the module directory structure (`components/{module-name}/`).
- **Security**: Never disable `contextIsolation`. Never enable `nodeIntegration`. All Node.js operations stay in main process.

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `@monaco-editor/react` | Code editor component |
| `@xterm/xterm` + `@xterm/addon-fit` | Terminal UI |
| `node-pty` | Pseudo-terminal (main process only) |
| `basic-ftp` | FTP client (main process only) |
| `keytar` | macOS Keychain access for passwords |
| `zustand` | State management |
| `lucide-react` | Icons |
| `class-variance-authority` + `clsx` + `tailwind-merge` | shadcn/ui utilities |

## Build Artifacts

- `out/main/` — Compiled main process
- `out/preload/` — Compiled preload script
- `out/renderer/` — Compiled renderer (HTML + JS + CSS)
- `release/` — Packaged app (from electron-builder)
