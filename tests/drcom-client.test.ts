import { describe, expect, it, vi } from 'vitest'
import { DrComClient, type RequestFunction } from '../src/main/drcom/client'

describe('Dr.COM 客户端', () => {
  it('向固定接口发送 GET，不缓存，并返回认证状态', async () => {
    const request = vi.fn<RequestFunction>().mockResolvedValue(new Response('dr1002({"result":1})'))
    const result = await new DrComClient(request).checkStatus()
    const [url, options] = request.mock.calls[0]
    expect(url.origin).toBe('http://127.0.0.1')
    expect(url.pathname).toBe('/drcom/chkstatus')
    expect(url.searchParams.get('callback')).toMatch(/^dr\d{4}$/)
    expect(url.searchParams.get('jsVersion')).toBe('4.X')
    expect(url.searchParams.get('v')).toMatch(/^\d+$/)
    expect(url.searchParams.get('lang')).toBe('zh')
    expect(url.searchParams.has('_')).toBe(false)
    expect(options.method).toBe('GET')
    expect(options.cache).toBe('no-store')
    expect(options.redirect).toBe('error')
    expect(result).toMatchObject({ ok: true, status: 'online' })
  })

  it.each([
    ['callback({"result":0})', 200, { ok: true, status: 'offline' }],
    ['callback({"result":1})', 503, { ok: false, status: 'unknown', code: 'http' }],
    ['<html>error</html>', 200, { ok: false, status: 'unknown', code: 'invalid-response' }],
    ['callback({"result":9})', 200, { ok: false, status: 'unknown', code: 'invalid-response' }]
  ] as const)('处理响应 %s / HTTP %s', async (body, status, expected) => {
    const request: RequestFunction = async () => new Response(body, { status })
    expect(await new DrComClient(request).checkStatus()).toMatchObject(expected)
  })

  it('网络失败不误判为未登录', async () => {
    const request: RequestFunction = async () => { throw new Error('connection refused') }
    expect(await new DrComClient(request).checkStatus()).toMatchObject({ ok: false, status: 'unknown', code: 'network' })
  })

  it('超时会取消请求，并允许下一次检测', async () => {
    vi.useFakeTimers()
    try {
      const request = vi.fn<RequestFunction>().mockImplementation((_url, options) => new Promise((_resolve, reject) => {
        options.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
      }))
      const client = new DrComClient(request, 5000)
      const pending = client.checkStatus()
      await vi.advanceTimersByTimeAsync(5000)
      expect(await pending).toMatchObject({ ok: false, status: 'unknown', code: 'timeout' })
      request.mockResolvedValue(new Response('callback({"result":1})'))
      expect(await client.checkStatus()).toMatchObject({ ok: true, status: 'online' })
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('登录请求包含抓包确认的全部参数，并对账号密码编码', async () => {
    const request = vi.fn<RequestFunction>().mockResolvedValue(new Response('dr1003({"result":1})'))
    const result = await new DrComClient(request).login({ username: '校园@账号', password: 'p@ss&+=' })
    const [url, options] = request.mock.calls[0]
    expect(url.origin).toBe('http://127.0.0.1')
    expect(url.pathname).toBe('/drcom/login')
    expect(url.searchParams.get('callback')).toMatch(/^dr\d{4}$/)
    expect(url.searchParams.get('jsVersion')).toBe('4.2.1')
    expect(url.searchParams.get('v')).toBe('2873')
    expect(url.searchParams.getAll('lang')).toEqual(['zh-cn', 'zh'])
    expect(Object.fromEntries(url.searchParams)).toEqual({
      callback: expect.stringMatching(/^dr\d{4}$/),
      DDDDD: '校园@账号',
      upass: 'p@ss&+=',
      '0MKKey': '123456',
      R1: '0',
      R2: '',
      R3: '0',
      R6: '0',
      para: '00',
      v6ip: '',
      terminal_type: '1',
      jsVersion: '4.2.1',
      v: '2873',
      lang: 'zh'
    })
    expect(options.method).toBe('GET')
    expect(result).toMatchObject({ ok: true })
  })

  it('账号密码无效时不发送请求', async () => {
    const request = vi.fn<RequestFunction>()
    expect(await new DrComClient(request).login({ username: ' ', password: '' }))
      .toMatchObject({ ok: false, code: 'invalid-credentials' })
    expect(request).not.toHaveBeenCalled()
  })

  it('登录被拒绝时返回明确失败', async () => {
    const request: RequestFunction = async () => new Response('dr1003({"result":0})')
    expect(await new DrComClient(request).login({ username: 'test', password: 'secret' }))
      .toMatchObject({ ok: false, code: 'rejected' })
  })

  it('登录成功时透传响应中的 uid', async () => {
    const request: RequestFunction = async () => new Response('dr1003({"result":1,"uid":"demo-student@telecom"})')
    expect(await new DrComClient(request).login({ username: 'test', password: 'secret' }))
      .toMatchObject({ ok: true, uid: 'demo-student@telecom' })
  })

  it('登录过程中不把请求参数或响应写入控制台', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      const request: RequestFunction = async () => new Response('dr1003({"result":1,"uid":"user@telecom"})')
      expect(await new DrComClient(request).login({ username: 'user', password: 'private-password' }))
        .toMatchObject({ ok: true })
      expect(log).not.toHaveBeenCalled()
    } finally {
      log.mockRestore()
    }
  })

  it('注销使用无参数 GET，并按 result=1 判断成功', async () => {
    const request = vi.fn<RequestFunction>().mockResolvedValue(new Response('dr1004({"result":1})'))
    expect(await new DrComClient(request).logout()).toMatchObject({ ok: true })
    const [url, options] = request.mock.calls[0]
    expect(url.href).toBe('http://127.0.0.1/drcom/logout')
    expect(url.search).toBe('')
    expect(options.method).toBe('GET')
  })

  it('注销结果为 0 时不误判成功', async () => {
    const request: RequestFunction = async () => new Response('dr1004({"result":0})')
    expect(await new DrComClient(request).logout()).toMatchObject({ ok: false, code: 'rejected' })
  })
})
