export interface ElectronApi {
  terminal: {
    create: (opts?: Record<string, unknown>) => Promise<{ id: string; pid: number }>
    write: (id: string, data: string) => Promise<void>
    resize: (id: string, cols: number, rows: number) => Promise<void>
    kill: (id: string) => Promise<void>
    onData: (callback: (id: string, data: string) => void) => () => void
  }
  ftp: {
    connect: (opts: Record<string, unknown>) => Promise<string>
    disconnect: (id: string) => Promise<void>
    list: (id: string, path: string) => Promise<unknown[]>
    download: (connId: string, remotePath: string, localPath: string) => Promise<void>
    upload: (connId: string, localPath: string, remotePath: string) => Promise<void>
    delete: (connId: string, path: string) => Promise<void>
    rename: (connId: string, oldPath: string, newPath: string) => Promise<void>
    mkdir: (connId: string, path: string) => Promise<void>
    onProgress: (callback: (progress: Record<string, unknown>) => void) => () => void
  }
  files: {
    read: (path: string, encoding?: string) => Promise<{ content: string; encoding: string }>
    write: (path: string, content: string, encoding?: string) => Promise<void>
    list: (path: string) => Promise<unknown[]>
    stat: (path: string) => Promise<unknown>
  }
  services: {
    define: (def: Record<string, unknown>) => Promise<void>
    start: (id: string) => Promise<void>
    stop: (id: string) => Promise<void>
    restart: (id: string) => Promise<void>
    list: () => Promise<unknown[]>
    onLog: (callback: (entry: Record<string, unknown>) => void) => () => void
    onStatusChange: (callback: (id: string, status: string) => void) => () => void
  }
}

declare global {
  interface Window {
    api: ElectronApi
  }
}
