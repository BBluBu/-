import { randomInt } from 'node:crypto'
import type {
  AuthActionResult,
  AuthErrorCode,
  LoginCredentials,
  StatusCheckResult,
  StatusErrorCode
} from '../../shared/types'
import { DRCOM_CONFIG } from './config'
import { parseLoginResponse, parseResultResponse, parseStatusResponse } from './jsonp'

export type RequestFunction = (url: URL, options: RequestInit) => Promise<Response>

type RequestResult =
  | { ok: true; text: string }
  | { ok: false; code: 'timeout' | 'network' | 'http'; message: string }

function statusFailure(code: StatusErrorCode, message: string): StatusCheckResult {
  return { ok: false, status: 'unknown', code, message, checkedAt: new Date().toISOString() }
}

function authFailure(code: AuthErrorCode, message: string): AuthActionResult {
  return { ok: false, code, message, checkedAt: new Date().toISOString() }
}

/** 统一构造接口地址；注销暂不传参数，后续抓包结果可直接传入。 */
function createUrl(path: string, params: Record<string, string> = {}): URL {
  const url = new URL(path, DRCOM_CONFIG.baseUrl)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  return url
}

export class DrComClient {
  constructor(
    private readonly request: RequestFunction,
    private readonly timeoutMs: number = DRCOM_CONFIG.timeoutMs
  ) {}

  async checkStatus(): Promise<StatusCheckResult> {
    const url = createUrl(DRCOM_CONFIG.statusPath, {
      callback: `dr${randomInt(1000, 10000)}`,
      jsVersion: DRCOM_CONFIG.jsVersion,
      v: randomInt(0, 1_000_000_000).toString(),
      lang: DRCOM_CONFIG.lang
    })

    const response = await this.get(url)
    if (!response.ok) return statusFailure(response.code, response.message)
    try {
      return { ok: true, status: parseStatusResponse(response.text), checkedAt: new Date().toISOString() }
    } catch {
      return statusFailure('invalid-response', '服务器返回了无法识别的状态数据。')
    }
  }

  async login(credentials: LoginCredentials): Promise<AuthActionResult> {
    if (typeof credentials?.username !== 'string' || !credentials.username.trim() ||
        typeof credentials.password !== 'string' || !credentials.password) {
      return authFailure('invalid-credentials', '请输入账号和密码。')
    }

    const url = createUrl(DRCOM_CONFIG.loginPath, {
      callback: `dr${randomInt(1000, 10000)}`,
      DDDDD: credentials.username,
      upass: credentials.password,
      '0MKKey': '123456',
      R1: '0',
      R2: '',
      R3: '0',
      R6: '0',
      para: '00',
      v6ip: '',
      terminal_type: '1',
      lang: 'zh-cn',
      jsVersion: '4.2.1',
      v: '2873'
    })
    // 抓包中依次包含 lang=zh-cn 与 lang=zh，不能用 set 覆盖前者。
    url.searchParams.append('lang', DRCOM_CONFIG.lang)

    const response = await this.get(url)
    if (!response.ok) return authFailure(response.code, response.message)
    try {
      const loginResult = parseLoginResponse(response.text)
      return loginResult.result === 1
        ? { ok: true, checkedAt: new Date().toISOString(), ...(loginResult.uid ? { uid: loginResult.uid } : {}) }
        : authFailure('rejected', '登录未成功，请检查账号、密码或服务器提示。')
    } catch {
      return authFailure('invalid-response', '服务器返回了无法识别的登录结果。')
    }
  }

  async logout(): Promise<AuthActionResult> {
    const url = createUrl(DRCOM_CONFIG.logoutPath)
    const response = await this.get(url)
    if (!response.ok) return authFailure(response.code, response.message)
    try {
      return parseResultResponse(response.text) === 1
        ? { ok: true, checkedAt: new Date().toISOString() }
        : authFailure('rejected', '注销未成功。')
    } catch {
      return authFailure('invalid-response', '服务器返回了无法识别的注销结果。')
    }
  }

  private async get(url: URL): Promise<RequestResult> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const response = await this.request(url, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store',
        redirect: 'error'
      })
      if (!response.ok) {
        return { ok: false, code: 'http', message: `请求失败：HTTP ${response.status}` }
      }
      const text = await response.text()
      return { ok: true, text }
    } catch {
      return controller.signal.aborted
        ? { ok: false, code: 'timeout', message: '请求超时，请确认已连接校园网后重试。' }
        : { ok: false, code: 'network', message: '无法访问校园网认证服务器，请检查网络连接。' }
    } finally {
      clearTimeout(timer)
    }
  }
}
