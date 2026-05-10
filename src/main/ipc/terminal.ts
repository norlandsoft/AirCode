import { ipcMain, BrowserWindow } from 'electron'
import { v4 as uuidv4 } from 'crypto'
import type { TerminalCreateOptions } from '../../shared/types'

// node-pty is a native module, imported dynamically
let pty: typeof import('node-pty') | null = null

const terminals = new Map<string, import('node-pty').IPty>()

function getPty() {
  if (!pty) {
    pty = require('node-pty')
  }
  return pty
}

export function registerTerminalHandlers(): void {
  ipcMain.handle('terminal:create', (event, opts: TerminalCreateOptions = {}) => {
    const { shell, cwd, env, cols = 80, rows = 24 } = opts
    const p = getPty()
    const id = crypto.randomUUID()

    const shellPath = shell || process.env.SHELL || '/bin/zsh'
    const args = shellPath.endsWith('zsh') || shellPath.endsWith('bash')
      ? ['-l']
      : []

    const terminal = p.spawn(shellPath, args, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: cwd || process.env.HOME,
      env: { ...process.env as Record<string, string>, ...env }
    })

    terminals.set(id, terminal)

    const win = BrowserWindow.fromWebContents(event.sender)

    terminal.onData((data: string) => {
      win?.webContents.send('terminal:on-data', id, data)
    })

    terminal.onExit(() => {
      terminals.delete(id)
    })

    return { id, pid: terminal.pid }
  })

  ipcMain.handle('terminal:write', (_event, id: string, data: string) => {
    const terminal = terminals.get(id)
    if (!terminal) throw new Error(`Terminal ${id} not found`)
    terminal.write(data)
  })

  ipcMain.handle('terminal:resize', (_event, id: string, cols: number, rows: number) => {
    const terminal = terminals.get(id)
    if (!terminal) throw new Error(`Terminal ${id} not found`)
    terminal.resize(cols, rows)
  })

  ipcMain.handle('terminal:kill', (_event, id: string) => {
    const terminal = terminals.get(id)
    if (!terminal) throw new Error(`Terminal ${id} not found`)
    terminal.kill()
    terminals.delete(id)
  })
}
