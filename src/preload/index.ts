import { contextBridge, ipcRenderer } from 'electron'

const api = {
  terminal: {
    create: (opts: Record<string, unknown>) => ipcRenderer.invoke('terminal:create', opts),
    write: (id: string, data: string) => ipcRenderer.invoke('terminal:write', id, data),
    resize: (id: string, cols: number, rows: number) => ipcRenderer.invoke('terminal:resize', id, cols, rows),
    kill: (id: string) => ipcRenderer.invoke('terminal:kill', id),
    onData: (callback: (id: string, data: string) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, id: string, data: string) => callback(id, data)
      ipcRenderer.on('terminal:on-data', handler)
      return () => ipcRenderer.removeListener('terminal:on-data', handler)
    }
  },
  files: {
    read: (path: string, encoding?: string) => ipcRenderer.invoke('files:read', path, encoding),
    write: (path: string, content: string, encoding?: string) => ipcRenderer.invoke('files:write', path, content, encoding),
    list: (path: string) => ipcRenderer.invoke('files:list', path),
    stat: (path: string) => ipcRenderer.invoke('files:stat', path),
    create: (options: { path: string; type: 'file' | 'directory' }) => ipcRenderer.invoke('files:create', options),
    rename: (oldPath: string, newPath: string) => ipcRenderer.invoke('files:rename', oldPath, newPath),
    delete: (path: string) => ipcRenderer.invoke('files:delete', path),
    search: (rootPath: string, query: string, maxResults?: number) => ipcRenderer.invoke('files:search', rootPath, query, maxResults)
  },
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),
    getAll: () => ipcRenderer.invoke('settings:getAll')
  },
  project: {
    openDialog: () => ipcRenderer.invoke('project:openDialog'),
    parseGitignore: (projectPath: string) => ipcRenderer.invoke('project:parseGitignore', projectPath)
  }
}

contextBridge.exposeInMainWorld('api', api)
