import type { FileNode, SearchResult } from '../../shared/types'

export interface ElectronApi {
  terminal: {
    create: (opts?: Record<string, unknown>) => Promise<{ id: string; pid: number }>
    write: (id: string, data: string) => Promise<void>
    resize: (id: string, cols: number, rows: number) => Promise<void>
    kill: (id: string) => Promise<void>
    onData: (callback: (id: string, data: string) => void) => () => void
  }
  files: {
    read: (path: string, encoding?: string) => Promise<{ content: string; encoding: string }>
    write: (path: string, content: string, encoding?: string) => Promise<void>
    list: (path: string) => Promise<FileNode[]>
    stat: (path: string) => Promise<{ size: number; isFile: boolean; isDirectory: boolean; modifiedAt: Date; createdAt: Date }>
    create: (options: { path: string; type: 'file' | 'directory' }) => Promise<void>
    rename: (oldPath: string, newPath: string) => Promise<void>
    delete: (path: string) => Promise<void>
    search: (rootPath: string, query: string, maxResults?: number) => Promise<SearchResult[]>
  }
  settings: {
    get: (key: string) => Promise<string | null>
    set: (key: string, value: string) => Promise<void>
    getAll: () => Promise<Record<string, string>>
  }
  project: {
    openDialog: () => Promise<string | null>
    parseGitignore: (projectPath: string) => Promise<string | null>
  }
}

declare global {
  interface Window {
    api: ElectronApi
  }
}
