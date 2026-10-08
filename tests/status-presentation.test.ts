import { describe, expect, it } from 'vitest'
import type { StatusCheckResult } from '../src/shared/types'
import { statusDiagnostics, statusPresentation } from '../src/renderer/src/statusPresentation'

const checkedAt = '2026-09-30T00:00:00Z'
const online: StatusCheckResult = { ok: true, status: 'online', checkedAt }
const offline: StatusCheckResult = { ok: true, status: 'offline', checkedAt }
const unreachable: StatusCheckResult = {
  ok: false, status: 'unknown', code: 'timeout', message: 'timeout', checkedAt
}

describe('状态卡片映射', () => {
  it('认证状态优先于公网检测结果', () => {
    expect(statusPresentation(online, 'Offline', false, 'demo-student@telecom'))
      .toMatchObject({ tone: 'online', title: '校园网已连接', description: '账号：示例用户' })
    expect(statusPresentation(offline, 'Online', false, null))
      .toMatchObject({ tone: 'offline', title: '等待认证' })
    expect(statusPresentation(online, 'Online', false, null))
      .toMatchObject({ tone: 'online', description: '账号：未提供' })
  })

  it('认证服务器不可达时区分公网可用和无网络', () => {
    expect(statusPresentation(unreachable, 'Online', false, null))
      .toMatchObject({ tone: 'internet', title: '互联网可用' })
    expect(statusPresentation(unreachable, 'Offline', false, null))
      .toMatchObject({ tone: 'unavailable', title: '网络不可用' })
  })

  it('认证响应异常时不误判为无网络', () => {
    const invalid: StatusCheckResult = { ...unreachable, code: 'invalid-response' }
    expect(statusPresentation(invalid, 'Offline', false, null))
      .toMatchObject({ tone: 'unknown', title: '状态未知' })
    const ipcFailure: StatusCheckResult = { ...unreachable, code: 'ipc', message: '通信失败' }
    expect(statusPresentation(ipcFailure, 'Online', false, null))
      .toMatchObject({ tone: 'unknown', title: '状态未知', description: '通信失败' })
  })

  it('分别给出认证服务器和公网探测的诊断结果', () => {
    expect(statusDiagnostics(unreachable, 'Offline')).toEqual({
      campus: '认证服务器请求超时',
      internet: '公网探测未通过，不能据此断定完全断网'
    })
    expect(statusDiagnostics(online, 'Online')).toEqual({
      campus: '已认证',
      internet: '公网可访问'
    })
  })
})
