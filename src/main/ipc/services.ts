import { ipcMain, BrowserWindow } from 'electron'
import * as serviceMgr from '../services/service-mgr'
import type { ServiceDefinition } from '../../shared/types'

export function registerServiceHandlers(): void {
  ipcMain.handle('services:define', (_event, def: ServiceDefinition) => {
    serviceMgr.defineService(def)
  })

  ipcMain.handle('services:start', (event, id: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    serviceMgr.startService(
      id,
      (stream, data) => {
        win?.webContents.send('services:on-log', {
          serviceId: id,
          timestamp: new Date(),
          stream,
          data
        })
      },
      (status) => {
        win?.webContents.send('services:on-status-change', id, status)
      }
    )
  })

  ipcMain.handle('services:stop', (_event, id: string) => {
    serviceMgr.stopService(id)
  })

  ipcMain.handle('services:restart', async (event, id: string) => {
    serviceMgr.stopService(id)
    // Wait a moment for the process to fully stop
    await new Promise((resolve) => setTimeout(resolve, 1000))
    const win = BrowserWindow.fromWebContents(event.sender)
    serviceMgr.startService(
      id,
      (stream, data) => {
        win?.webContents.send('services:on-log', {
          serviceId: id,
          timestamp: new Date(),
          stream,
          data
        })
      },
      (status) => {
        win?.webContents.send('services:on-status-change', id, status)
      }
    )
  })

  ipcMain.handle('services:list', () => {
    return serviceMgr.listServices()
  })
}
