import type { InternetStatus, StatusCheckResult } from '../../shared/types'
import { accountDisplayName } from './accountDisplay'

export interface StatusPresentation {
  tone: 'checking' | 'online' | 'offline' | 'internet' | 'unavailable' | 'unknown'
  title: string
  description: string
}

export function statusDiagnostics(
  campus: StatusCheckResult | null,
  internet: InternetStatus | null
): { campus: string; internet: string } {
  const campusText = !campus
    ? '检测中'
    : campus.ok
      ? campus.status === 'online' ? '已认证' : '等待认证'
      : campus.code === 'timeout'
        ? '认证服务器请求超时'
        : campus.code === 'network'
          ? '无法访问认证服务器'
          : `检测失败：${campus.message}`
  const internetText = internet === null
    ? '检测中'
    : internet === 'Online' ? '公网可访问' : '公网探测未通过，不能据此断定完全断网'
  return { campus: campusText, internet: internetText }
}

export function statusPresentation(
  campus: StatusCheckResult | null,
  internet: InternetStatus | null,
  checking: boolean,
  uid: string | null
): StatusPresentation {
  if (checking || !campus || !internet) {
    return { tone: 'checking', title: '正在检测', description: '正在检测校园网认证和互联网状态，请稍候。' }
  }
  if (campus.ok) {
    if (campus.status === 'online') {
      return { tone: 'online', title: '校园网已连接', description: `账号：${accountDisplayName(uid) ?? '未提供'}` }
    }
    return { tone: 'offline', title: '等待认证', description: '校园网连接正常，请登录账号。' }
  }

  const campusUnreachable = campus.code === 'network' || campus.code === 'timeout'
  if (campusUnreachable && internet === 'Online') {
    return {
      tone: 'internet',
      title: '互联网可用',
      description: '当前未连接校园网认证环境，请连接学校 WiFi 后登录。'
    }
  }
  if (campusUnreachable && internet === 'Offline') {
    return { tone: 'unavailable', title: '网络不可用', description: '请检查 WiFi 或网络连接。' }
  }
  return { tone: 'unknown', title: '状态未知', description: campus.message }
}
