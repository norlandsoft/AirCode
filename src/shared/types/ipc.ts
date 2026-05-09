export interface IpcChannel {
  terminal: {
    create: 'terminal:create'
    write: 'terminal:write'
    resize: 'terminal:resize'
    kill: 'terminal:kill'
    onData: 'terminal:on-data'
  }
  ftp: {
    connect: 'ftp:connect'
    disconnect: 'ftp:disconnect'
    list: 'ftp:list'
    download: 'ftp:download'
    upload: 'ftp:upload'
    delete: 'ftp:delete'
    rename: 'ftp:rename'
    mkdir: 'ftp:mkdir'
    onProgress: 'ftp:on-progress'
  }
  files: {
    read: 'files:read'
    write: 'files:write'
    list: 'files:list'
    stat: 'files:stat'
    watch: 'files:watch'
    onChange: 'files:on-change'
  }
  services: {
    define: 'services:define'
    start: 'services:start'
    stop: 'services:stop'
    restart: 'services:restart'
    list: 'services:list'
    onLog: 'services:on-log'
    onStatusChange: 'services:on-status-change'
  }
}

export type TerminalCreateOptions = {
  shell?: string
  cwd?: string
  env?: Record<string, string>
  cols?: number
  rows?: number
}

export type FtpConnectOptions = {
  host: string
  port?: number
  user: string
  password?: string
  secure?: boolean
}

export type FileReadResult = {
  content: string
  encoding: string
}

export type ServiceDefinition = {
  id: string
  name: string
  command: string
  args?: string[]
  cwd?: string
  env?: Record<string, string>
  healthCheckUrl?: string
}
