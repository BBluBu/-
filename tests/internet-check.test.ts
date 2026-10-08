import { describe, expect, it, vi } from 'vitest'
import { InternetCheck, type InternetRequest } from '../src/main/internet/check'

const MICROSOFT_URL = 'http://www.msftconnecttest.com/connecttest.txt'
const BAIDU_URL = 'https://www.baidu.com/'

describe('InternetCheck', () => {
  it('公网探测独立于 Dr.COM，任一探测成功即为 Online', async () => {
    const request = vi.fn<InternetRequest>().mockImplementation(async (url) =>
      url === MICROSOFT_URL
        ? new Response('Microsoft Connect Test')
        : new Response('unavailable', { status: 503 }))
    expect(await new InternetCheck(request).check()).toBe('Online')
    expect(request.mock.calls.map(([url]) => url)).toEqual([MICROSOFT_URL, BAIDU_URL])
    for (const [, options] of request.mock.calls) {
      expect(options).toMatchObject({ method: 'GET', cache: 'no-store', redirect: 'error' })
    }
  })

  it('微软探测失败时，HTTPS 公网站点可作为备用', async () => {
    const request: InternetRequest = async (url) =>
      url === MICROSOFT_URL ? new Response('<html>portal</html>') : new Response('ok')
    expect(await new InternetCheck(request).check()).toBe('Online')
  })

  it('两个探测均失败才返回 Offline', async () => {
    const request: InternetRequest = async (url) => {
      if (url === MICROSOFT_URL) return new Response('<html>portal</html>')
      throw new Error('offline')
    }
    expect(await new InternetCheck(request).check()).toBe('Offline')
  })

  it('超时即使请求不响应取消信号也能返回 Offline', async () => {
    vi.useFakeTimers()
    try {
      const request: InternetRequest = () => new Promise(() => {})
      const pending = new InternetCheck(request, 5000).check()
      await vi.advanceTimersByTimeAsync(5000)
      expect(await pending).toBe('Offline')
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })
})
