import { app, BrowserWindow, shell, nativeImage } from 'electron'
import { join } from 'path'
import { registerTerminalHandlers } from './ipc/terminal'
import { registerFileHandlers } from './ipc/files'
import { registerSettingsHandlers } from './ipc/settings'
import { registerProjectHandlers } from './ipc/project'
import { closeDb } from './db'

let mainWindow: BrowserWindow | null = null

function registerIpcHandlers(): void {
  registerTerminalHandlers()
  registerFileHandlers()
  registerSettingsHandlers()
  registerProjectHandlers()
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    icon: nativeImage.createFromPath(join(__dirname, '../../resources/icon.png')),
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 8 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('close', () => {
    closeDb()
    app.quit()
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  closeDb()
  app.quit()
})
