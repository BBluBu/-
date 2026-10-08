import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { getRememberedCredentials, saveRememberedCredentials } from './credentialStore'
import {
  CLOSE_WINDOW_CHANNEL,
  MINIMIZE_WINDOW_CHANNEL,
  GET_STARTUP_SETTINGS_CHANNEL,
  SET_STARTUP_ENABLED_CHANNEL,
  GET_CREDENTIALS_CHANNEL,
  SAVE_CREDENTIALS_CHANNEL,
  type StartupSettings
} from '../shared/types'

function trustedWindow(event: IpcMainInvokeEvent): BrowserWindow {
  const window = BrowserWindow.fromWebContents(event.sender)
  if (!window || event.senderFrame !== event.sender.mainFrame) {
    throw new Error('不允许此来源操作应用设置')
  }
  return window
}

function readStartupSettings(): StartupSettings {
  if (process.platform !== 'win32' || !app.isPackaged) {
    return { available: false, enabled: false }
  }
  try {
    const settings = app.getLoginItemSettings({ path: process.execPath })
    return {
      available: true,
      enabled: settings.openAtLogin && settings.executableWillLaunchAtLogin !== false
    }
  } catch {
    return { available: false, enabled: false }
  }
}

export function registerAppIpc(): void {
  ipcMain.handle(GET_CREDENTIALS_CHANNEL, (event) => {
    trustedWindow(event)
    return getRememberedCredentials()
  })
  ipcMain.handle(SAVE_CREDENTIALS_CHANNEL, (event, value: unknown) => {
    trustedWindow(event)
    saveRememberedCredentials(value)
  })
  ipcMain.handle(GET_STARTUP_SETTINGS_CHANNEL, (event): StartupSettings => {
    trustedWindow(event)
    return readStartupSettings()
  })

  ipcMain.handle(SET_STARTUP_ENABLED_CHANNEL, (event, enabled: unknown): StartupSettings => {
    trustedWindow(event)
    if (typeof enabled !== 'boolean') throw new Error('无效的启动设置')
    if (!readStartupSettings().available) return { available: false, enabled: false }
    app.setLoginItemSettings({ openAtLogin: enabled, path: process.execPath, name: 'CampusLogin' })
    return readStartupSettings()
  })

  ipcMain.handle(CLOSE_WINDOW_CHANNEL, (event): void => {
    trustedWindow(event).close()
  })
  ipcMain.handle(MINIMIZE_WINDOW_CHANNEL, (event): void => {
    trustedWindow(event).minimize()
  })
}
