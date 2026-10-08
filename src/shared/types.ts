export type CampusStatus = 'online' | 'offline' | 'unknown'

export type InternetStatus = 'Online' | 'Offline'

export type StatusErrorCode =
  | 'timeout'
  | 'network'
  | 'http'
  | 'invalid-response'
  | 'busy'
  | 'ipc'

export type StatusCheckResult =
  | { ok: true; status: 'online' | 'offline'; checkedAt: string }
  | { ok: false; status: 'unknown'; code: StatusErrorCode; message: string; checkedAt: string }

export interface LoginCredentials {
  username: string
  password: string
}

export type AuthErrorCode = StatusErrorCode | 'invalid-credentials' | 'rejected'

export type AuthActionResult =
  | { ok: true; checkedAt: string; uid?: string }
  | { ok: false; code: AuthErrorCode; message: string; checkedAt: string }

export interface StartupSettings {
  available: boolean
  enabled: boolean
}

export interface RememberedCredentials {
  available: boolean
  credentials: LoginCredentials | null
  message?: string
}

export interface CampusLoginApi {
  checkStatus: () => Promise<StatusCheckResult>
  checkInternet: () => Promise<InternetStatus>
  login: (credentials: LoginCredentials) => Promise<AuthActionResult>
  logout: () => Promise<AuthActionResult>
  getStartupSettings: () => Promise<StartupSettings>
  setStartupEnabled: (enabled: boolean) => Promise<StartupSettings>
  closeWindow: () => Promise<void>
  minimizeWindow: () => Promise<void>
  getRememberedCredentials: () => Promise<RememberedCredentials>
  saveRememberedCredentials: (credentials: LoginCredentials | null) => Promise<void>
}

export const CHECK_STATUS_CHANNEL = 'campus-login:check-status'
export const CHECK_INTERNET_CHANNEL = 'campus-login:check-internet'
export const LOGIN_CHANNEL = 'campus-login:login'
export const LOGOUT_CHANNEL = 'campus-login:logout'
export const GET_STARTUP_SETTINGS_CHANNEL = 'campus-login:get-startup-settings'
export const SET_STARTUP_ENABLED_CHANNEL = 'campus-login:set-startup-enabled'
export const CLOSE_WINDOW_CHANNEL = 'campus-login:close-window'
export const MINIMIZE_WINDOW_CHANNEL = 'campus-login:minimize-window'
export const GET_CREDENTIALS_CHANNEL = 'campus-login:get-credentials'
export const SAVE_CREDENTIALS_CHANNEL = 'campus-login:save-credentials'
