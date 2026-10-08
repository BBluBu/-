import { app, safeStorage } from 'electron'
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { LoginCredentials, RememberedCredentials } from '../shared/types'

function available(): boolean {
  return process.platform === 'win32' && safeStorage.isEncryptionAvailable()
}

function filePath(): string {
  return join(app.getPath('userData'), 'remembered-credentials.json')
}

export function getRememberedCredentials(): RememberedCredentials {
  const encryptionAvailable = available()
  if (!encryptionAvailable) return { available: false, credentials: null }
  try {
    const stored = JSON.parse(readFileSync(filePath(), 'utf8'))
    if (stored.version !== 1 || typeof stored.username !== 'string' || !stored.username.trim() ||
        typeof stored.encryptedPassword !== 'string' || !stored.encryptedPassword) throw new Error('invalid file')
    const password = safeStorage.decryptString(Buffer.from(stored.encryptedPassword, 'base64'))
    if (!password) throw new Error('empty password')
    return { available: true, credentials: { username: stored.username, password } }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { available: true, credentials: null }
    return { available: true, credentials: null, message: '无法读取已保存的密码，请重新输入并登录。' }
  }
}

export function saveRememberedCredentials(value: unknown): void {
  const target = filePath()
  if (value === null) {
    try {
      rmSync(target, { force: true })
      rmSync(`${target}.tmp`, { force: true })
    } catch {
      throw new Error('未能删除已保存的密码，请重试。')
    }
    return
  }
  const credentials = value as Partial<LoginCredentials> | undefined
  if (!credentials || typeof credentials.username !== 'string' || typeof credentials.password !== 'string' ||
      !credentials.username.trim() || !credentials.password || credentials.username.length > 256 || credentials.password.length > 4096) {
    throw new Error('无效的账号或密码')
  }
  if (!available()) throw new Error('Windows 密码加密暂不可用，无法记住密码。')
  try {
    const encryptedPassword = safeStorage.encryptString(credentials.password).toString('base64')
    mkdirSync(app.getPath('userData'), { recursive: true })
    writeFileSync(`${target}.tmp`, JSON.stringify({ version: 1, username: credentials.username.trim(), encryptedPassword }), { mode: 0o600 })
    renameSync(`${target}.tmp`, target)
  } catch {
    try { rmSync(`${target}.tmp`, { force: true }) } catch { /* 保留原始保存失败提示 */ }
    throw new Error('密码保存失败，请稍后重试。')
  }
}
