import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const mocks = vi.hoisted(() => ({
  getPath: vi.fn(), available: vi.fn(), encrypt: vi.fn(), decrypt: vi.fn()
}))
vi.mock('electron', () => ({
  app: { getPath: mocks.getPath },
  safeStorage: { isEncryptionAvailable: mocks.available, encryptString: mocks.encrypt, decryptString: mocks.decrypt }
}))
import { getRememberedCredentials, saveRememberedCredentials } from '../src/main/credentialStore'

let directory: string
let file: string
beforeEach(() => {
  vi.resetAllMocks()
  directory = mkdtempSync(join(tmpdir(), 'campuslogin-credentials-'))
  file = join(directory, 'remembered-credentials.json')
  mocks.getPath.mockReturnValue(directory)
  mocks.available.mockReturnValue(true)
  mocks.encrypt.mockReturnValue(Buffer.from('opaque-encrypted-by-os'))
  mocks.decrypt.mockReturnValue('test-password')
})
afterEach(() => rmSync(directory, { recursive: true, force: true }))

describe('加密密码配置', () => {
  it('只写入密文并将密码与账号一起恢复', () => {
    expect(getRememberedCredentials()).toEqual({ available: true, credentials: null })
    saveRememberedCredentials({ username: ' user@telecom ', password: 'test-password' })
    expect(readFileSync(file, 'utf8')).not.toContain('test-password')
    expect(mocks.encrypt).toHaveBeenCalledWith('test-password')
    expect(getRememberedCredentials()).toEqual({ available: true, credentials: { username: 'user@telecom', password: 'test-password' } })
    expect(mocks.decrypt).toHaveBeenCalledWith(Buffer.from('opaque-encrypted-by-os'))
    saveRememberedCredentials({ username: 'second', password: 'different' })
    expect(getRememberedCredentials().credentials?.username).toBe('second')
  })

  it('加密不可用时拒绝保存，仍可删除旧密码', () => {
    saveRememberedCredentials({ username: 'user', password: 'test-password' })
    mocks.available.mockReturnValue(false)
    expect(getRememberedCredentials()).toEqual({ available: false, credentials: null })
    expect(() => saveRememberedCredentials({ username: 'user', password: 'test-password' })).toThrow()
    saveRememberedCredentials(null)
    expect(existsSync(file)).toBe(false)
  })

  it('损坏或无法解密的配置不会填充密码', () => {
    writeFileSync(file, '{bad json')
    expect(getRememberedCredentials()).toMatchObject({ credentials: null, message: expect.any(String) })
    saveRememberedCredentials({ username: 'user', password: 'test-password' })
    mocks.decrypt.mockImplementation(() => { throw new Error('decrypt failed') })
    expect(getRememberedCredentials()).toMatchObject({ credentials: null, message: expect.any(String) })
  })

  it('无效输入和加密失败不覆盖已保存的密码', () => {
    saveRememberedCredentials({ username: 'user', password: 'test-password' })
    const original = readFileSync(file, 'utf8')
    for (const value of [{}, { username: 'user', password: '' }, 'password']) {
      expect(() => saveRememberedCredentials(value)).toThrow()
    }
    mocks.encrypt.mockImplementation(() => { throw new Error('encrypt failed') })
    expect(() => saveRememberedCredentials({ username: 'second', password: 'different' })).toThrow()
    expect(readFileSync(file, 'utf8')).toBe(original)
  })
})
