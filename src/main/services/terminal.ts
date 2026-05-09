import { app } from 'electron'
import { join } from 'path'
import { homedir } from 'os'

export function getDefaultShell(): string {
  return process.env.SHELL || '/bin/zsh'
}

export function getDefaultCwd(): string {
  return app.getPath('home') || homedir()
}

export function getPtyEnv(): Record<string, string> {
  return {
    ...process.env as Record<string, string>,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor'
  }
}
