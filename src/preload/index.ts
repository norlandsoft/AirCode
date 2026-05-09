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
  ftp: {
    connect: (opts: Record<string, unknown>) => ipcRenderer.invoke('ftp:connect', opts),
    disconnect: (id: string) => ipcRenderer.invoke('ftp:disconnect', id),
    list: (id: string, path: string) => ipcRenderer.invoke('ftp:list', id, path),
    download: (connId: string, remotePath: string, localPath: string) => ipcRenderer.invoke('ftp:download', connId, remotePath, localPath),
    upload: (connId: string, localPath: string, remotePath: string) => ipcRenderer.invoke('ftp:upload', connId, localPath, remotePath),
    delete: (connId: string, path: string) => ipcRenderer.invoke('ftp:delete', connId, path),
    rename: (connId: string, oldPath: string, newPath: string) => ipcRenderer.invoke('ftp:rename', connId, oldPath, newPath),
    mkdir: (connId: string, path: string) => ipcRenderer.invoke('ftp:mkdir', connId, path),
    onProgress: (callback: (progress: Record<string, unknown>) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, progress: Record<string, unknown>) => callback(progress)
      ipcRenderer.on('ftp:on-progress', handler)
      return () => ipcRenderer.removeListener('ftp:on-progress', handler)
    }
  },
  files: {
    read: (path: string, encoding?: string) => ipcRenderer.invoke('files:read', path, encoding),
    write: (path: string, content: string, encoding?: string) => ipcRenderer.invoke('files:write', path, content, encoding),
    list: (path: string) => ipcRenderer.invoke('files:list', path),
    stat: (path: string) => ipcRenderer.invoke('files:stat', path)
  },
  services: {
    define: (def: Record<string, unknown>) => ipcRenderer.invoke('services:define', def),
    start: (id: string) => ipcRenderer.invoke('services:start', id),
    stop: (id: string) => ipcRenderer.invoke('services:stop', id),
    restart: (id: string) => ipcRenderer.invoke('services:restart', id),
    list: () => ipcRenderer.invoke('services:list'),
    onLog: (callback: (entry: Record<string, unknown>) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, entry: Record<string, unknown>) => callback(entry)
      ipcRenderer.on('services:on-log', handler)
      return () => ipcRenderer.removeListener('services:on-log', handler)
    },
    onStatusChange: (callback: (id: string, status: string) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, id: string, status: string) => callback(id, status)
      ipcRenderer.on('services:on-status-change', handler)
      return () => ipcRenderer.removeListener('services:on-status-change', handler)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)
