import { ipcMain, dialog, BrowserWindow } from 'electron'
import { readFile } from 'fs/promises'
import { join } from 'path'

export function registerProjectHandlers(): void {
  ipcMain.handle('project:openDialog', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: '选择项目文件夹'
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('project:parseGitignore', async (_event, projectPath: string) => {
    const gitignorePath = join(projectPath, '.gitignore')
    try {
      const content = await readFile(gitignorePath, 'utf-8')
      return content
    } catch {
      return null
    }
  })
}
