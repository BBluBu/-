import { describe, expect, it } from 'vitest'
import { accountDisplayName } from '../src/renderer/src/accountDisplay'

describe('账号欢迎称呼', () => {
  it('识别已配置账号及其运营商后缀', () => {
    expect(accountDisplayName('demo-student')).toBe('示例用户')
    expect(accountDisplayName('demo-student@telecom')).toBe('示例用户')
  })

  it('其他账号保留原样，避免误认', () => {
    expect(accountDisplayName('1demo-student@telecom')).toBe('1demo-student@telecom')
    expect(accountDisplayName('another@telecom')).toBe('another@telecom')
    expect(accountDisplayName(null)).toBeNull()
  })
})
