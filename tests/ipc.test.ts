import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { IpcMainInvokeEvent } from 'electron'
import {
  CHECK_STATUS_CHANNEL,
  CHECK_INTERNET_CHANNEL,
  LOGIN_CHANNEL,
  LOGOUT_CHANNEL,
  type AuthActionResult,
  type StatusCheckResult
} from '../src/shared/types'

const mocks = vi.hoisted(() => ({ handle: vi.fn(), fromWebContents: vi.fn() }))
vi.mock('electron', () => ({
  ipcMain: { handle: mocks.handle },
  BrowserWindow: { fromWebContents: mocks.fromWebContents }
}))
import { registerDrComIpc } from '../src/main/ipc'

const statusResult: StatusCheckResult = { ok: true, status: 'online', checkedAt: '2026-09-29T00:00:00Z' }
const authResult: AuthActionResult = { ok: true, checkedAt: '2026-09-29T00:00:00Z' }

function setup(overrides: Record<string, unknown> = {}) {
  const frame = {}
  const event = { sender: { mainFrame: frame }, senderFrame: frame } as unknown as IpcMainInvokeEvent
  mocks.fromWebContents.mockReturnValue({})
  const client = {
    checkStatus: vi.fn().mockResolvedValue(statusResult),
    login: vi.fn().mockResolvedValue(authResult),
    logout: vi.fn().mockResolvedValue(authResult),
    ...overrides
  }
  const internetCheck = { check: vi.fn().mockResolvedValue('Online') }
  registerDrComIpc(client, internetCheck)
  function handler(channel: string): (event: IpcMainInvokeEvent, data?: unknown) => Promise<unknown> {
    return mocks.handle.mock.calls.find(([name]) => name === channel)?.[1]
  }
  return { event, client, internetCheck, handler }
}

beforeEach(() => vi.clearAllMocks())

describe('Dr.COM IPC', () => {
  it('注册独立的公网检测与三个认证通道并返回结果', async () => {
    const { event, client, handler } = setup()
    expect(mocks.handle.mock.calls.map(([name]) => name)).toEqual([
      CHECK_STATUS_CHANNEL, CHECK_INTERNET_CHANNEL, LOGIN_CHANNEL, LOGOUT_CHANNEL
    ])
    expect(await handler(CHECK_STATUS_CHANNEL)(event)).toEqual(statusResult)
    expect(await handler(CHECK_INTERNET_CHANNEL)(event)).toBe('Online')
    expect(await handler(LOGIN_CHANNEL)(event, { username: 'user', password: 'secret' })).toEqual(authResult)
    expect(await handler(LOGOUT_CHANNEL)(event)).toEqual(authResult)
    expect(client.login).toHaveBeenCalledWith({ username: 'user', password: 'secret' })
  })

  it('拒绝子框架和非应用窗口', async () => {
    const { event, client, internetCheck, handler } = setup()
    await expect(handler(LOGOUT_CHANNEL)({ ...event, senderFrame: {} } as IpcMainInvokeEvent)).rejects.toThrow()
    mocks.fromWebContents.mockReturnValue(null)
    await expect(handler(CHECK_STATUS_CHANNEL)(event)).rejects.toThrow()
    await expect(handler(CHECK_INTERNET_CHANNEL)(event)).rejects.toThrow()
    expect(client.logout).not.toHaveBeenCalled()
    expect(client.checkStatus).not.toHaveBeenCalled()
    expect(internetCheck.check).not.toHaveBeenCalled()
  })

  it('登录凭据无效时不调用客户端', async () => {
    const { event, client, handler } = setup()
    expect(await handler(LOGIN_CHANNEL)(event, { username: ' ', password: '' }))
      .toMatchObject({ ok: false, code: 'invalid-credentials' })
    expect(await handler(LOGIN_CHANNEL)(event, null))
      .toMatchObject({ ok: false, code: 'invalid-credentials' })
    expect(client.login).not.toHaveBeenCalled()
  })

  it('跨状态、登录、注销操作阻止并发，并在完成后释放', async () => {
    let resolveCheck!: (value: StatusCheckResult) => void
    const checkStatus = vi.fn(() => new Promise<StatusCheckResult>((resolve) => { resolveCheck = resolve }))
    const { event, client, handler } = setup({ checkStatus })
    const pending = handler(CHECK_STATUS_CHANNEL)(event)
    expect(await handler(LOGIN_CHANNEL)(event, { username: 'user', password: 'secret' }))
      .toMatchObject({ ok: false, code: 'busy' })
    expect(await handler(LOGOUT_CHANNEL)(event)).toMatchObject({ ok: false, code: 'busy' })
    expect(client.login).not.toHaveBeenCalled()
    expect(client.logout).not.toHaveBeenCalled()
    resolveCheck(statusResult)
    expect(await pending).toEqual(statusResult)
    expect(await handler(LOGOUT_CHANNEL)(event)).toEqual(authResult)
  })

  it('客户端异常后仍可再次调用', async () => {
    const checkStatus = vi.fn().mockRejectedValueOnce(new Error('failure')).mockResolvedValue(statusResult)
    const { event, handler } = setup({ checkStatus })
    await expect(handler(CHECK_STATUS_CHANNEL)(event)).rejects.toThrow('failure')
    expect(await handler(CHECK_STATUS_CHANNEL)(event)).toEqual(statusResult)
  })
})
