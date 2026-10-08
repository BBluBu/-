const accountNames: Record<string, string> = {
  'demo-student': '示例用户'
}

export function accountDisplayName(account: string | null): string | null {
  const value = account?.trim()
  if (!value) return null

  const accountId = value.split('@', 1)[0]
  return accountNames[accountId] ?? value
}
