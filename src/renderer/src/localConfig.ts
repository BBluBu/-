const REMEMBERED_ACCOUNT_KEY = 'campus-login:remembered-account'
const THEME_KEY = 'campus-login:theme'
export type ThemePreference = 'system' | 'light' | 'dark'

export function loadTheme(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch { return 'system' }
}

export function saveTheme(theme: ThemePreference): boolean {
  try { localStorage.setItem(THEME_KEY, theme); return true } catch { return false }
}

export function loadRememberedAccount(): string {
  try {
    return localStorage.getItem(REMEMBERED_ACCOUNT_KEY)?.trim() ?? ''
  } catch {
    return ''
  }
}

export function saveRememberedAccount(account: string | null): boolean {
  try {
    if (account?.trim()) {
      localStorage.setItem(REMEMBERED_ACCOUNT_KEY, account.trim())
    } else {
      localStorage.removeItem(REMEMBERED_ACCOUNT_KEY)
    }
    return true
  } catch {
    return false
  }
}
