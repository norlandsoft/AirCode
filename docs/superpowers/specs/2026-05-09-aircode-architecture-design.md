# AirCode - Personal Development Workstation Design

## Overview

AirCode is a local Mac desktop tool built on Electron + React + TypeScript, integrating code editing, terminal operations, service management, and FTP client into a single-window multi-panel interface. It replaces the need for separate terminal, SSH client, Git GUI, IDE, and Docker management tools for daily development work.

## Tech Stack

- **Framework**: Electron (via electron-vite)
- **Frontend**: React + TypeScript
- **Build**: Vite (electron-vite)
- **UI**: shadcn/ui + Tailwind CSS
- **State**: zustand
- **Editor**: Monaco Editor (@monaco-editor/react)
- **Terminal**: xterm.js + node-pty
- **FTP**: basic-ftp
- **Package Manager**: npm

## Architecture: electron-vite Monorepo

```
AirCode/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.ts             # Entry: create window, register IPC
│   │   ├── ipc/                 # IPC handlers by module
│   │   │   ├── terminal.ts      # node-pty management
│   │   │   ├── ftp.ts           # basic-ftp connect/transfer
│   │   │   ├── files.ts         # File system operations
│   │   │   └── services.ts      # Service start/stop management
│   │   └── services/            # Main process business logic
│   │       ├── terminal.ts      # pty spawn management
│   │       ├── ftp-client.ts    # FTP connection wrapper
│   │       └── service-mgr.ts   # Process/service management
│   │
│   ├── preload/
│   │   └── index.ts             # contextBridge API exposure
│   │
│   ├── shared/                  # Shared types between processes
│   │   └── types/
│   │       ├── ipc.ts           # IPC message types
│   │       ├── module.ts        # Module interface definitions
│   │       ├── terminal.ts      # Terminal types
│   │       ├── ftp.ts           # FTP types
│   │       └── services.ts      # Service management types
│   │
│   └── renderer/                # React rendering process
│       ├── index.html
│       ├── main.tsx             # React entry
│       ├── App.tsx              # Root layout
│       ├── components/
│       │   ├── layout/          # Framework layout
│       │   │   ├── Sidebar.tsx  # Module navigation
│       │   │   ├── TabBar.tsx   # Tab management
│       │   │   └── StatusBar.tsx # Status aggregation
│       │   ├── editor/          # Monaco editor
│       │   ├── terminal/        # xterm.js terminal
│       │   ├── ftp/             # FTP client UI
│       │   └── services/        # Service management UI
│       ├── hooks/               # Custom hooks
│       ├── stores/              # zustand stores
│       ├── modules/             # Module registration system
│       │   └── registry.ts      # Module registry
│       └── lib/                 # Utility functions
│
├── resources/                   # Icons and static assets
├── electron.vite.config.ts
├── electron-builder.yml5
├── tsconfig.json
├── tsconfig.node.json
├── tsconfig.web.json
├── tailwind.config.ts
├── postcss.config.js
├── components.json              # shadcn/ui config
└── package.json
```

## Window Layout

Single-window multi-panel (VSCode-like):

```
┌───────────────────────────────────┐
│  Menu Bar                         │
├────┬──────────────────────────────┤
│    │  [Tabs: Editor|Term|FTP|Svc] │
│ S  │ ┌───────────────────────────┐│
│ i  │ │                           ││
│ d  │ │   Main Content Area       ││
│ e  │ │   (Editor / Terminal /    ││
│ b  │ │    FTP / Service Mgmt)    ││
│ a  │ │                           ││
│ r  │ └───────────────────────────┘│
├────┴──────────────────────────────┤
│  Status Bar                       │
└───────────────────────────────────┘
```

## Module System (Extensible)

Each feature module implements a unified `Module` interface for plug-and-play registration:

```typescript
interface AirCodeModule {
  id: string                        // Unique: 'editor' | 'terminal' | 'ftp' | ...
  name: string                      // Display name
  icon: string                      // Sidebar icon
  component: React.ComponentType    // Render component
  mainProcessHandlers?: () => void  // Register IPC handlers (optional)
  statusContributions?: StatusItem[] // Status bar items (optional)
}
```

Adding a new module requires only: implement interface → register → appears in UI automatically.

### Phase 1 Modules

- **Editor** (Monaco Editor): multi-tab editing, syntax highlighting, file I/O via IPC
- **Terminal** (xterm.js + node-pty): multi-tab terminals, bash/zsh support
- **FTP Client** (basic-ftp): connection management, file browser, transfer queue, edit-and-sync
- **Service Manager**: Spring Boot service start/stop/restart, log viewing, health check

### Future Modules

- **AI Agent**: intelligent assistance, code generation
- **CI/CD**: pipeline management and monitoring
- **Web Browser**: embedded browser for docs/API testing
- **Chat**: conversation interface

## Core Modules Detail

### Editor

- Multi-tab editing with modified-state markers
- File I/O through IPC (no direct fs access in renderer)
- Language support: Java, TypeScript/JavaScript, XML, YAML, Properties, SQL, Dockerfile
- Features: syntax highlighting, code folding, search/replace, multi-cursor

### Terminal

- Multi-tab terminals, each backed by an independent pty process
- Auto-detect user default shell (bash/zsh)
- xterm-addon-fit for responsive panel resizing
- Data flow via IPC: renderer ↔ main ↔ pty

### Service Manager

- Manage local service processes (Spring Boot primary use case)
- Service definition config: name, start command, working directory, health check URL
- Operations: start/stop/restart, log output, status monitoring
- Log capture via pty or child_process, real-time display

### FTP Client

- Connection management: save configs (host, port, username; passwords via macOS Keychain)
- File browser: tree directory view, upload/download, create/delete/rename
- Transfer queue: progress display
- Editor integration: double-click remote file → download to temp → Monaco open → auto-upload on save

## IPC Communication Architecture

```
Renderer                    Preload                     Main
   |                          |                          |
   |  window.api.terminal     |   ipcRenderer.invoke     |
   |  .create(opts)           | ──────────────────────►  |
   |                          |                          | → pty.spawn()
   |  onTerminalData(cb)      |   ipcRenderer.on         |
   | ◄─────────────────────── | ◄────────────────────── | ← pty.onData()
```

- Request/response: `ipcRenderer.invoke` / `ipcMain.handle` (Promise-based)
- Streaming data (terminal output, logs): `ipcRenderer.on` / `webContents.send`
- Shared types in `src/shared/types/`

## Security

- **contextIsolation: true** + **nodeIntegration: false**
- Main process exclusively holds Node APIs (fs, child_process, net)
- FTP passwords stored via macOS Keychain (keytar), never in plaintext on disk
- All IPC calls validated at preload layer

## Dependencies

| Package | Purpose | Process |
|---------|---------|---------|
| electron | Desktop framework | main |
| electron-vite | Build toolchain | build |
| react / react-dom | UI framework | renderer |
| @monaco-editor/react | Code editor | renderer |
| xterm / xterm-addon-fit | Terminal UI | renderer |
| node-pty | Pseudo-terminal | main |
| basic-ftp | FTP client | main |
| zustand | State management | renderer |
| tailwindcss / postcss / autoprefixer | Styling | build |
| keytar | Keychain access | main |
| typescript | Type system | build |
