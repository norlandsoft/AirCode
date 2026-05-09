import { ipcMain } from 'electron'
import { readFile, writeFile, readdir, stat } from 'fs/promises'
import { join } from 'path'

export function registerFileHandlers(): void {
  ipcMain.handle('files:read', async (_event, path: string, encoding: BufferEncoding = 'utf-8') => {
    const content = await readFile(path, encoding)
    return { content, encoding }
  })

  ipcMain.handle('files:write', async (_event, path: string, content: string, encoding: BufferEncoding = 'utf-8') => {
    await writeFile(path, content, encoding)
  })

  ipcMain.handle('files:list', async (_event, dirPath: string) => {
    const entries = await readdir(dirPath, { withFileTypes: true })
    return entries.map((entry) => ({
      name: entry.name,
      path: join(dirPath, entry.name),
      isDirectory: entry.isDirectory(),
      isFile: entry.isFile()
    }))
  })

  ipcMain.handle('files:stat', async (_event, path: string) => {
    const stats = await stat(path)
    return {
      size: stats.size,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
      modifiedAt: stats.mtime,
      createdAt: stats.birthtime
    }
  })
}
