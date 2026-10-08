import type { InternetStatus } from '../../shared/types'

export type InternetRequest = (url: string, options: RequestInit) => Promise<Response>

// Windows NCSI 探测加独立的 HTTPS 公网探测，避免单个站点故障造成误判。
const PROBES: Array<{ url: string; valid: (response: Response, body: string) => boolean }> = [
  { url: 'http://www.msftconnecttest.com/connecttest.txt', valid: (response: Response, body: string) => response.ok && body.trim() === 'Microsoft Connect Test' },
  { url: 'https://www.baidu.com/', valid: (response: Response) => response.ok }
] as const

export class InternetCheck {
  constructor(
    private readonly request: InternetRequest,
    private readonly timeoutMs = 5000
  ) {}

  async check(): Promise<InternetStatus> {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const checks = PROBES.map(async (probe) => {
        const response = await this.request(probe.url, {
          method: 'GET',
          signal: controller.signal,
          cache: 'no-store',
          redirect: 'error'
        })
        const body = probe.url.startsWith('http:') && response.ok ? await response.text() : ''
        if (!probe.valid(response, body)) throw new Error('Public probe failed')
      })
      const timeout = new Promise<false>((resolve) => {
        timer = setTimeout(() => {
          controller.abort()
          resolve(false)
        }, this.timeoutMs)
      })
      return await Promise.race([Promise.any(checks).then(() => true, () => false), timeout])
        ? 'Online' : 'Offline'
    } catch {
      return 'Offline'
    } finally {
      if (timer) clearTimeout(timer)
      controller.abort()
    }
  }
}
