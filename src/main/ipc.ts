import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'
import {
  CHECK_STATUS_CHANNEL,
  CHECK_INTERNET_CHANNEL,
  LOGIN_CHANNEL,
  LOGOUT_CHANNEL,
  type AuthActionResult,
  type LoginCredentials,
  type InternetStatus,
  type StatusCheckResult
} from '../shared/types'
import type { DrComClient } from './drcom/client'
import type { InternetCheck } from './internet/check'

function isLoginCredentials(value: unknown): value is LoginCredentials {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const credentials = value as Record<string, unknown>
  return typeof credentials.username === 'string' && credentials.username.trim().length > 0 &&
    typeof credentials.password === 'string' && credentials.password.length > 0
}

function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const window = BrowserWindow.fromWebContents(event.sender)
  if (!window || event.senderFrame !== event.sender.mainFrame) {
    throw new Error('不允许此来源调用校园网接口')
  }
}

export function registerDrComIpc(
  client: Pick<DrComClient, 'checkStatus' | 'login' | 'logout'>,
  internetCheck: Pick<InternetCheck, 'check'>
): void {
  let busy = false

  async function run<T>(action: () => Promise<T>, busyResult: T): Promise<T> {
    if (busy) return busyResult
    busy = true
    try {
      return await action()
    } finally {
      busy = false
    }
  }

  function busyAuthResult(): AuthActionResult {
    return {
      ok: false,
      code: 'busy',
      message: '校园网操作正在进行，请稍后再试。',
      checkedAt: new Date().toISOString()
    }
  }

  ipcMain.handle(CHECK_STATUS_CHANNEL, async (event): Promise<StatusCheckResult> => {
    assertTrustedSender(event)
    return run(() => client.checkStatus(), {
      ok: false,
      status: 'unknown',
      code: 'busy',
      message: '校园网操作正在进行，请稍后再试。',
      checkedAt: new Date().toISOString()
    })
  })

  ipcMain.handle(CHECK_INTERNET_CHANNEL, async (event): Promise<InternetStatus> => {
    assertTrustedSender(event)
    return internetCheck.check()
  })

  ipcMain.handle(LOGIN_CHANNEL, async (event, credentials: unknown): Promise<AuthActionResult> => {
    assertTrustedSender(event)
    if (!isLoginCredentials(credentials)) {
      return {
        ok: false,
        code: 'invalid-credentials',
        message: '请输入账号和密码。',
        checkedAt: new Date().toISOString()
      }
    }
    return run(() => client.login(credentials), busyAuthResult())
  })

  ipcMain.handle(LOGOUT_CHANNEL, async (event): Promise<AuthActionResult> => {
    assertTrustedSender(event)
    return run(() => client.logout(), busyAuthResult())
  })
}
