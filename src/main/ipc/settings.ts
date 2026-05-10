import { ipcMain } from 'electron'
import * as settingsDb from '../db/settings'

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get', (_event, key: string) => {
    return settingsDb.getSetting(key)
  })

  ipcMain.handle('settings:set', (_event, key: string, value: string) => {
    settingsDb.setSetting(key, value)
  })

  ipcMain.handle('settings:getAll', () => {
    return settingsDb.getAllSettings()
  })
}
