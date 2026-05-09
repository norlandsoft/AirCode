import { ipcMain } from 'electron'
import { readFile, writeFile, readdir, stat, mkdir, rename, unlink, rm } from 'fs/promises'
import { join, dirname } from 'path'

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

  ipcMain.handle('files:create', async (_event, options: { path: string; type: 'file' | 'directory' }) => {
    const { path: targetPath, type } = options
    if (type === 'directory') {
      await mkdir(targetPath, { recursive: true })
    } else {
      const dir = dirname(targetPath)
      await mkdir(dir, { recursive: true })
      await writeFile(targetPath, '', 'utf-8')
    }
  })

  ipcMain.handle('files:rename', async (_event, oldPath: string, newPath: string) => {
    await rename(oldPath, newPath)
  })

  ipcMain.handle('files:delete', async (_event, targetPath: string) => {
    const stats = await stat(targetPath)
    if (stats.isDirectory()) {
      await rm(targetPath, { recursive: true })
    } else {
      await unlink(targetPath)
    }
  })

  ipcMain.handle('files:search', async (_event, rootPath: string, query: string, maxResults = 500) => {
    const results: Array<{ filePath: string; fileName: string; line: number; column: number; text: string; matchStart: number; matchEnd: number }> = []
    const lowerQuery = query.toLowerCase()

    async function walk(dir: string): Promise<void> {
      if (results.length >= maxResults) return
      const entries = await readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (results.length >= maxResults) return
        const fullPath = join(dir, entry.name)
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'build') continue
          await walk(fullPath)
        } else if (entry.isFile()) {
          try {
            const content = await readFile(fullPath, 'utf-8')
            const lines = content.split('\n')
            for (let i = 0; i < lines.length; i++) {
              if (results.length >= maxResults) return
              const lineText = lines[i]
              const idx = lineText.toLowerCase().indexOf(lowerQuery)
              if (idx !== -1) {
                results.push({
                  filePath: fullPath,
                  fileName: entry.name,
                  line: i + 1,
                  column: idx + 1,
                  text: lineText,
                  matchStart: idx,
                  matchEnd: idx + query.length
                })
              }
            }
          } catch {
            // skip binary or unreadable files
          }
        }
      }
    }

    await walk(rootPath)
    return results
  })
}
