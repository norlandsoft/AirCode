export interface IpcChannel {
  terminal: {
    create: 'terminal:create'
    write: 'terminal:write'
    resize: 'terminal:resize'
    kill: 'terminal:kill'
    onData: 'terminal:on-data'
  }
  files: {
    read: 'files:read'
    write: 'files:write'
    list: 'files:list'
    stat: 'files:stat'
    create: 'files:create'
    rename: 'files:rename'
    delete: 'files:delete'
    search: 'files:search'
    watch: 'files:watch'
    onChange: 'files:on-change'
  }
  project: {
    openDialog: 'project:openDialog'
    parseGitignore: 'project:parseGitignore'
  }
}

export type TerminalCreateOptions = {
  shell?: string
  cwd?: string
  env?: Record<string, string>
  cols?: number
  rows?: number
}

export type FileReadResult = {
  content: string
  encoding: string
}

export type FileCreateOptions = {
  path: string
  type: 'file' | 'directory'
}

export type FileRenameOptions = {
  oldPath: string
  newPath: string
}

export type FileSearchOptions = {
  rootPath: string
  query: string
  maxResults?: number
}
