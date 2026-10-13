import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { IpcMainInvokeEvent } from 'electron'
import {
  CLOSE_WINDOW_CHANNEL,
  MINIMIZE_WINDOW_CHANNEL,
  GET_STARTUP_SETTINGS_CHANNEL,
  SET_STARTUP_ENABLED_CHANNEL,
  GET_CREDENTIALS_CHANNEL,
  SAVE_CREDENTIALS_CHANNEL
} from '../src/shared/types'

const mocks = vi.hoisted(() => ({
  handle: vi.fn(),
  fromWebContents: vi.fn(),
  getLoginItemSettings: vi.fn(),
  setLoginItemSettings: vi.fn(),
  close: vi.fn(),
  minimize: vi.fn(),
  getCredentials: vi.fn(),
  saveCredentials: vi.fn(),
  isPackaged: true
}))

vi.mock('../src/main/credentialStore', () => ({
  getRememberedCredentials: mocks.getCredentials,
  saveRememberedCredentials: mocks.saveCredentials
}))

vi.mock('electron', () => ({
  ipcMain: { handle: mocks.handle },
  BrowserWindow: { fromWebContents: mocks.fromWebContents },
  app: {
    get isPackaged() { return mocks.isPackaged },
    getLoginItemSettings: mocks.getLoginItemSettings,
    setLoginItemSettings: mocks.setLoginItemSettings
  }
}))

import { registerAppIpc } from '../src/main/appIpc'

function setup() {
  const frame = {}
  const event = { sender: { mainFrame: frame }, senderFrame: frame } as unknown as IpcMainInvokeEvent
  mocks.fromWebContents.mockReturnValue({ close: mocks.close, minimize: mocks.minimize })
  registerAppIpc()
  function handler(channel: string): (event: IpcMainInvokeEvent, value?: unknown) => unknown {
    return mocks.handle.mock.calls.find(([name]) => name === channel)?.[1]
  }
  return { event, handler }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.isPackaged = true
  mocks.getLoginItemSettings.mockReturnValue({ openAtLogin: false, executableWillLaunchAtLogin: false })
})

describe('应用操作 IPC', () => {
  it('仅允许可信主页面最小化自己的窗口', () => {
    const { event, handler } = setup()
    handler(MINIMIZE_WINDOW_CHANNEL)(event)
    expect(mocks.minimize).toHaveBeenCalledOnce()
    const childFrame = { ...event, senderFrame: {} } as IpcMainInvokeEvent
    expect(() => handler(MINIMIZE_WINDOW_CHANNEL)(childFrame)).toThrow()
    mocks.fromWebContents.mockReturnValue(null)
    expect(() => handler(MINIMIZE_WINDOW_CHANNEL)(event)).toThrow()
    expect(mocks.minimize).toHaveBeenCalledOnce()
  })
  it('密码配置只允许当前可信窗口访问', () => {
    const { event, handler } = setup()
    const credentials = { username: 'user', password: 'test-password' }
    mocks.getCredentials.mockReturnValue({ available: true, credentials })
    expect(handler(GET_CREDENTIALS_CHANNEL)(event)).toEqual({ available: true, credentials })
    handler(SAVE_CREDENTIALS_CHANNEL)(event, credentials)
    expect(mocks.saveCredentials).toHaveBeenCalledWith(credentials)
    const otherFrame = { ...event, senderFrame: {} } as IpcMainInvokeEvent
    expect(() => handler(GET_CREDENTIALS_CHANNEL)(otherFrame)).toThrow()
    expect(() => handler(SAVE_CREDENTIALS_CHANNEL)(otherFrame, null)).toThrow()
    expect(mocks.getCredentials).toHaveBeenCalledOnce()
    expect(mocks.saveCredentials).toHaveBeenCalledOnce()
  })
  it('已打包时可设置 Windows 登录时启动，并读取生效状态', async () => {
    const { event, handler } = setup()
    expect(await handler(GET_STARTUP_SETTINGS_CHANNEL)(event)).toEqual({ available: true, enabled: false })
    mocks.setLoginItemSettings.mockImplementation(() => {
      mocks.getLoginItemSettings.mockReturnValue({ openAtLogin: true, executableWillLaunchAtLogin: true })
    })
    expect(await handler(SET_STARTUP_ENABLED_CHANNEL)(event, true)).toEqual({ available: true, enabled: true })
    expect(mocks.setLoginItemSettings).toHaveBeenCalledWith(expect.objectContaining({ openAtLogin: true }))
  })

  it('开发版不写入开机启动设置', async () => {
    mocks.isPackaged = false
    const { event, handler } = setup()
    expect(await handler(GET_STARTUP_SETTINGS_CHANNEL)(event)).toEqual({ available: false, enabled: false })
    expect(await handler(SET_STARTUP_ENABLED_CHANNEL)(event, true)).toEqual({ available: false, enabled: false })
    expect(mocks.setLoginItemSettings).not.toHaveBeenCalled()
  })

  it('自定义名称的启动项存在时，不因默认名称未注册而误报失败', () => {
    const { event, handler } = setup()
    mocks.getLoginItemSettings.mockReturnValue({
      openAtLogin: false, executableWillLaunchAtLogin: true,
      launchItems: [{ name: 'CampusLogin', path: process.execPath, scope: 'user', enabled: true }]
    })
    expect(handler(GET_STARTUP_SETTINGS_CHANNEL)(event)).toEqual({ available: true, enabled: true })
  })

  it('Windows 禁用的自定义启动项显示为关闭', () => {
    const { event, handler } = setup()
    mocks.getLoginItemSettings.mockReturnValue({
      openAtLogin: true, executableWillLaunchAtLogin: true,
      launchItems: [{ name: 'CampusLogin', path: process.execPath, scope: 'user', enabled: false }]
    })
    expect(handler(GET_STARTUP_SETTINGS_CHANNEL)(event)).toEqual({ available: true, enabled: false })
  })

  it('关闭时同时撤销启动注册及启用状态', () => {
    const { event, handler } = setup()
    mocks.setLoginItemSettings.mockImplementation(() => {
      mocks.getLoginItemSettings.mockReturnValue({ openAtLogin: false, executableWillLaunchAtLogin: false })
    })
    expect(handler(SET_STARTUP_ENABLED_CHANNEL)(event, false)).toEqual({ available: true, enabled: false })
    expect(mocks.setLoginItemSettings).toHaveBeenCalledWith({
      openAtLogin: false, enabled: false, path: process.execPath, name: 'CampusLogin'
    })
  })

  it('关闭当前窗口，并拒绝非可信页面与无效设置', async () => {
    const { event, handler } = setup()
    expect(() => handler(SET_STARTUP_ENABLED_CHANNEL)(event, 'true')).toThrow()
    handler(CLOSE_WINDOW_CHANNEL)(event)
    expect(mocks.close).toHaveBeenCalledOnce()
    const childFrame = { ...event, senderFrame: {} } as IpcMainInvokeEvent
    expect(() => handler(CLOSE_WINDOW_CHANNEL)(childFrame)).toThrow()
  })
})
