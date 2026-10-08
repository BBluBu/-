import { app, BrowserWindow, net, screen } from 'electron'
import { join } from 'node:path'
import { DrComClient } from './drcom/client'
import { InternetCheck } from './internet/check'
import { registerDrComIpc } from './ipc'
import { registerAppIpc } from './appIpc'

function createWindow(): void {
  const workArea = screen.getPrimaryDisplay().workAreaSize
  const window = new BrowserWindow({
    width: Math.min(680, workArea.width - 32),
    height: Math.min(640, workArea.height - 48),
    useContentSize: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    frame: false,
    title: 'CampusLogin',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  window.setMenu(null)
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event) => event.preventDefault())

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

void app.whenReady().then(() => {
  const client = new DrComClient((url, options) => net.fetch(url.toString(), options))
  const internetCheck = new InternetCheck((url, options) => net.fetch(url, options))
  registerDrComIpc(client, internetCheck)
  registerAppIpc()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
