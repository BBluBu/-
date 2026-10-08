import { contextBridge, ipcRenderer } from 'electron'
import {
  CHECK_STATUS_CHANNEL,
  CHECK_INTERNET_CHANNEL,
  LOGIN_CHANNEL,
  LOGOUT_CHANNEL,
  GET_STARTUP_SETTINGS_CHANNEL,
  SET_STARTUP_ENABLED_CHANNEL,
  CLOSE_WINDOW_CHANNEL,
  MINIMIZE_WINDOW_CHANNEL,
  GET_CREDENTIALS_CHANNEL,
  SAVE_CREDENTIALS_CHANNEL,
  type CampusLoginApi,
  type StatusCheckResult,
  type InternetStatus,
  type AuthActionResult,
  type LoginCredentials,
  type StartupSettings
} from '../shared/types'

const api: CampusLoginApi = {
  checkStatus: (): Promise<StatusCheckResult> => ipcRenderer.invoke(CHECK_STATUS_CHANNEL),
  checkInternet: (): Promise<InternetStatus> => ipcRenderer.invoke(CHECK_INTERNET_CHANNEL),
  login: (credentials: LoginCredentials): Promise<AuthActionResult> => ipcRenderer.invoke(LOGIN_CHANNEL, credentials),
  logout: (): Promise<AuthActionResult> => ipcRenderer.invoke(LOGOUT_CHANNEL),
  getStartupSettings: (): Promise<StartupSettings> => ipcRenderer.invoke(GET_STARTUP_SETTINGS_CHANNEL),
  setStartupEnabled: (enabled: boolean): Promise<StartupSettings> => ipcRenderer.invoke(SET_STARTUP_ENABLED_CHANNEL, enabled),
  closeWindow: (): Promise<void> => ipcRenderer.invoke(CLOSE_WINDOW_CHANNEL),
  minimizeWindow: (): Promise<void> => ipcRenderer.invoke(MINIMIZE_WINDOW_CHANNEL),
  getRememberedCredentials: () => ipcRenderer.invoke(GET_CREDENTIALS_CHANNEL),
  saveRememberedCredentials: (credentials) => ipcRenderer.invoke(SAVE_CREDENTIALS_CHANNEL, credentials)
}

contextBridge.exposeInMainWorld('campusLogin', api)
