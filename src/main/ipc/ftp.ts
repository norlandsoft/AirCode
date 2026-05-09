import { ipcMain, BrowserWindow } from 'electron'
import * as ftpService from '../services/ftp-client'
import type { FtpConnectOptions } from '../../shared/types'

export function registerFtpHandlers(): void {
  ipcMain.handle('ftp:connect', (_event, opts: FtpConnectOptions) => {
    return ftpService.createConnection(opts)
  })

  ipcMain.handle('ftp:disconnect', (_event, id: string) => {
    return ftpService.disconnect(id)
  })

  ipcMain.handle('ftp:list', (_event, id: string, path: string) => {
    return ftpService.listDirectory(id, path)
  })

  ipcMain.handle('ftp:download', (_event, connId: string, remotePath: string, localPath: string) => {
    return ftpService.download(connId, remotePath, localPath)
  })

  ipcMain.handle('ftp:upload', (_event, connId: string, localPath: string, remotePath: string) => {
    return ftpService.upload(connId, localPath, remotePath)
  })

  ipcMain.handle('ftp:delete', (_event, connId: string, path: string) => {
    return ftpService.remove(connId, path)
  })

  ipcMain.handle('ftp:rename', (_event, connId: string, oldPath: string, newPath: string) => {
    return ftpService.rename(connId, oldPath, newPath)
  })

  ipcMain.handle('ftp:mkdir', (_event, connId: string, path: string) => {
    return ftpService.mkdir(connId, path)
  })
}
