import { describe, expect, it } from 'vitest'
import { parseJsonp, parseLoginResponse, parseResultResponse, parseStatusResponse } from '../src/main/drcom/jsonp'

describe('JSONP 解析', () => {
  it('支持空白、BOM、回调名和可选分号', () => {
    expect(parseJsonp('\uFEFF  drcom.callback ( {"result":1} );\n')).toEqual({ result: 1 })
    expect(parseJsonp('callback({"result":0})')).toEqual({ result: 0 })
  })

  it('正确映射已登录与未登录', () => {
    expect(parseStatusResponse('callback({"result":1})')).toBe('online')
    expect(parseStatusResponse('callback({"result":0})')).toBe('offline')
  })

  it('登录和注销共用安全的 JSONP result 解析', () => {
    expect(parseResultResponse('dr1003({"result":1})')).toBe(1)
    expect(parseResultResponse('dr1004({"result":0})')).toBe(0)
  })

  it('从成功登录响应读取 uid，缺失时不编造账号', () => {
    expect(parseLoginResponse('dr1003({"result":1,"uid":"demo-student@telecom"})'))
      .toEqual({ result: 1, uid: 'demo-student@telecom' })
    expect(parseLoginResponse('dr1003({"result":1})')).toEqual({ result: 1 })
  })

  it.each([
    '<html>认证页面</html>',
    '{"result":1}',
    'callback({"result":1}); alert(1)',
    'callback((globalThis.executed = true))',
    'callback({"result":1}',
    'callback({result:1})'
  ])('拒绝无效数据和脚本：%s', (text) => {
    expect(() => parseStatusResponse(text)).toThrow()
  })

  it.each(['null', '[]', '{}', '{"result":2}', '{"result":"1"}', '{"result":true}'])('拒绝不明确的状态：%s', (body) => {
    expect(() => parseStatusResponse(`callback(${body})`)).toThrow()
  })
})
