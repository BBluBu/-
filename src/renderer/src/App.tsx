import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { AuthErrorCode, InternetStatus, StartupSettings, StatusCheckResult } from '../../shared/types'
import { accountDisplayName } from './accountDisplay'
import { loadRememberedAccount, saveRememberedAccount, loadTheme, saveTheme, type ThemePreference } from './localConfig'
import { statusDiagnostics, statusPresentation } from './statusPresentation'
import { loadBackgroundEnabled, saveBackgroundEnabled, loadCustomBackground, saveCustomBackground, validateBackground } from './backgroundStore'
import dayScene from './assets/south-park-day.jpg'
import nightScene from './assets/south-park-night.png'
import avatar from './assets/cartman-avatar.jpg'
import SettingsDialog from './SettingsDialog'
import WindowTitleBar from './WindowTitleBar'

type Feedback = { kind: 'success' | 'warning' | 'error'; text: string }
type StatusTone = ReturnType<typeof statusPresentation>['tone']

const statusLabels: Record<StatusTone, string> = {
  checking: '检测中',
  online: '已认证',
  offline: '待认证',
  internet: '公网可用',
  unavailable: '连接失败',
  unknown: '待确认'
}

function StatusGlyph({ tone }: { tone: StatusTone }) {
  if (tone === 'checking') return <span className="loading-ring" />

  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {tone === 'online' && <><circle cx="24" cy="24" r="15" /><path d="m17 24 5 5 10-11" /></>}
      {tone === 'offline' && <><rect x="14" y="21" width="20" height="17" rx="4" /><path d="M18 21v-5a6 6 0 0 1 12 0v5" /></>}
      {tone === 'internet' && <><circle cx="24" cy="24" r="15" /><path d="M9 24h30M24 9c5 4 8 9 8 15s-3 11-8 15M24 9c-5 4-8 9-8 15s3 11 8 15" /></>}
      {tone === 'unavailable' && <><path d="M8 18a25 25 0 0 1 32 0M13 24a17 17 0 0 1 22 0M19 31a8 8 0 0 1 10 0" /><path d="M10 10 38 38" /></>}
      {tone === 'unknown' && <><circle cx="24" cy="24" r="15" /><path d="M19 19a5 5 0 1 1 7 5c-2 1-2 2-2 4M24 34h.01" /></>}
    </svg>
  )
}

function loginErrorMessage(code: AuthErrorCode, fallback: string): string {
  switch (code) {
    case 'invalid-credentials': return '请填写校园网账号和密码。'
    case 'rejected': return '认证未通过，请检查账号和密码后重试。'
    case 'timeout': return '登录请求超时，请确认校园网连接后重试。'
    case 'network': return '无法连接认证服务器，请检查校园网连接。'
    case 'http': return '认证服务暂时不可用，请稍后重试。'
    case 'invalid-response': return '认证服务器返回异常，请稍后重试。'
    case 'busy': return '正在处理其他请求，请稍后再试。'
    default: return fallback
  }
}

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [backgroundEnabled, setBackgroundEnabled] = useState(loadBackgroundEnabled)
  const [customBackground, setCustomBackground] = useState<Blob | null>(null)
  const [customBackgroundUrl, setCustomBackgroundUrl] = useState<string | null>(null)
  const [backgroundLoading, setBackgroundLoading] = useState(true)
  const [backgroundSaving, setBackgroundSaving] = useState(false)
  const backgroundInput = useRef<HTMLInputElement>(null)
  const [theme, setTheme] = useState(loadTheme)
  const [savedAccount] = useState(loadRememberedAccount)
  const [username, setUsername] = useState(savedAccount)
  const [rememberAccount, setRememberAccount] = useState(Boolean(savedAccount))
  const [password, setPassword] = useState('')
  const [rememberPassword, setRememberPassword] = useState(false)
  const [passwordStorageAvailable, setPasswordStorageAvailable] = useState(false)
  const [credentialsLoading, setCredentialsLoading] = useState(true)
  const [configSaving, setConfigSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [checking, setChecking] = useState(true)
  const [loggingIn, setLoggingIn] = useState(false)
  const [result, setResult] = useState<StatusCheckResult | null>(null)
  const [internetStatus, setInternetStatus] = useState<InternetStatus | null>(null)
  const [authenticatedAccount, setAuthenticatedAccount] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [startupSettings, setStartupSettings] = useState<StartupSettings>({ available: false, enabled: false })
  const operationInProgress = useRef(false)

  useEffect(() => {
    let active = true
    void loadCustomBackground().then((image) => { if (active) setCustomBackground(image) })
      .catch(() => { if (active) setFeedback({ kind: 'warning', text: '无法读取自定义背景，已使用内置背景。' }) })
      .finally(() => { if (active) setBackgroundLoading(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!customBackground) { setCustomBackgroundUrl(null); return }
    const url = URL.createObjectURL(customBackground)
    setCustomBackgroundUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [customBackground])

  function handleBackgroundEnabled(enabled: boolean): void {
    setBackgroundEnabled(enabled)
    if (!saveBackgroundEnabled(enabled)) setFeedback({ kind: 'warning', text: '背景已切换，但设置未能保存。' })
  }

  async function handleCustomBackground(file: File | null): Promise<void> {
    if (!file || backgroundSaving) return
    setBackgroundSaving(true)
    try {
      await validateBackground(file)
      await saveCustomBackground(file)
      setCustomBackground(file)
      handleBackgroundEnabled(true)
    } catch (error) {
      setFeedback({ kind: 'warning', text: error instanceof Error ? error.message : '背景保存失败，请重试。' })
    } finally { setBackgroundSaving(false) }
  }

  async function handleRestoreBackground(): Promise<void> {
    setBackgroundSaving(true)
    try { await saveCustomBackground(null); setCustomBackground(null) }
    catch { setFeedback({ kind: 'warning', text: '无法恢复内置背景，请重试。' }) }
    finally { setBackgroundSaving(false) }
  }

  useEffect(() => {
    const system = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      document.documentElement.dataset.theme = theme === 'system' ? (system.matches ? 'dark' : 'light') : theme
    }
    apply()
    system.addEventListener('change', apply)
    return () => system.removeEventListener('change', apply)
  }, [theme])

  function handleThemeChange(value: ThemePreference): void {
    setTheme(value)
    if (!saveTheme(value)) setFeedback({ kind: 'warning', text: '主题已切换，但未能保存，下次启动将跟随系统。' })
  }

  async function handleClearSavedInfo(): Promise<void> {
    if (operationInProgress.current || credentialsLoading || configSaving) return
    setConfigSaving(true)
    try {
      await window.campusLogin.saveRememberedCredentials(null)
      setRememberPassword(false)
      setPassword('')
      setShowPassword(false)
      if (!saveRememberedAccount(null)) {
        setFeedback({ kind: 'warning', text: '密码已清除，但账号未能清除，请重试。' })
        return
      }
      setRememberAccount(false)
      setUsername('')
      setFeedback({ kind: 'success', text: '已清除保存的账号和密码，当前认证不受影响。' })
    } catch {
      setFeedback({ kind: 'error', text: '未能清除已保存的信息，请重试。' })
    } finally { setConfigSaving(false) }
  }

  function handleUsernameChange(value: string): void {
    if (value !== username) setPassword('')
    setUsername(value)
    if (rememberAccount && !saveRememberedAccount(value)) {
      setFeedback({ kind: 'warning', text: '无法保存账号到本地，请检查应用存储是否可用。' })
    }
  }

  async function handleRememberPasswordChange(checked: boolean): Promise<void> {
    if (checked) {
      if (!saveRememberedAccount(username)) {
        setFeedback({ kind: 'warning', text: '无法保存账号，请稍后重试。' })
        return
      }
      setRememberAccount(true)
      setRememberPassword(true)
      return
    }
    setConfigSaving(true)
    try {
      await window.campusLogin.saveRememberedCredentials(null)
      setRememberPassword(false)
    } catch {
      setFeedback({ kind: 'warning', text: '未能删除已保存的密码，请重试。' })
    } finally {
      setConfigSaving(false)
    }
  }

  function handleRememberAccountChange(checked: boolean): void {
    if (!saveRememberedAccount(checked ? username : null)) {
      setFeedback({ kind: 'warning', text: '无法更新本地账号设置，请稍后重试。' })
      return
    }
    setRememberAccount(checked)
  }

  async function handleStartupChange(enabled: boolean): Promise<void> {
    try {
      const updated = await window.campusLogin.setStartupEnabled(enabled)
      setStartupSettings(updated)
      if (updated.enabled !== enabled) {
        setFeedback({ kind: 'warning', text: '未能更新开机启动设置，请检查 Windows 启动应用设置。' })
      }
    } catch {
      setFeedback({ kind: 'warning', text: '开机启动设置失败，请稍后重试。' })
    }
  }

  async function handleClose(): Promise<void> {
    try {
      await window.campusLogin.closeWindow()
    } catch {
      setFeedback({ kind: 'error', text: '无法关闭应用，请使用窗口右上角的关闭按钮。' })
    }
  }

  async function handleMinimize(): Promise<void> {
    try { await window.campusLogin.minimizeWindow() }
    catch { setFeedback({ kind: 'error', text: '暂时无法最小化窗口，请重试。' }) }
  }

  async function checkStatus(): Promise<StatusCheckResult> {
    setChecking(true)
    try {
      const [current, internet] = await Promise.all([
        window.campusLogin.checkStatus().catch((): StatusCheckResult => ({
          ok: false,
          status: 'unknown',
          code: 'ipc',
          message: '状态检测通信失败，请重新打开应用后重试。',
          checkedAt: new Date().toISOString()
        })),
        window.campusLogin.checkInternet().catch((): InternetStatus => 'Offline')
      ])
      setResult(current)
      setInternetStatus(internet)
      if (current.status === 'offline') setAuthenticatedAccount(null)
      return current
    } catch {
      const failure: StatusCheckResult = {
        ok: false,
        status: 'unknown',
        code: 'ipc',
        message: '状态检测通信失败，请重新打开应用后重试。',
        checkedAt: new Date().toISOString()
      }
      setResult(failure)
      setInternetStatus('Offline')
      return failure
    } finally {
      setChecking(false)
    }
  }

  async function handleStatusCheck(): Promise<void> {
    if (operationInProgress.current) return
    operationInProgress.current = true
    setFeedback(null)
    try {
      await checkStatus()
    } finally {
      operationInProgress.current = false
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (operationInProgress.current) return
    if (!username.trim() || !password) {
      setFeedback({ kind: 'error', text: '请填写校园网账号和密码。' })
      return
    }

    operationInProgress.current = true
    setLoggingIn(true)
    setFeedback(null)
    let loginSucceeded = false
    try {
      const login = await window.campusLogin.login({ username: username.trim(), password })
      if (!login.ok) {
        setFeedback({ kind: 'error', text: loginErrorMessage(login.code, login.message) })
        return
      }

      loginSucceeded = true
      setAuthenticatedAccount(login.uid?.trim() || username.trim())
      let passwordSaveFailed = false
      if (rememberPassword) {
        try {
          await window.campusLogin.saveRememberedCredentials({ username: username.trim(), password })
        } catch {
          passwordSaveFailed = true
        }
      }
      const current = await checkStatus()
      setFeedback(!current.ok
        ? { kind: 'warning', text: '登录请求已提交，但暂时无法确认认证状态，请稍后重新检测。' }
        : current.status === 'online'
          ? { kind: 'success', text: '登录成功，已通过校园网认证。' }
          : { kind: 'warning', text: '登录请求已提交，但当前仍显示未认证，请稍后重新检测。' })
      if (passwordSaveFailed) {
        setFeedback((currentFeedback) => ({ kind: 'warning', text: `${currentFeedback?.text ?? ''} 密码未能保存，下次打开时请检查并重新输入。` }))
      }
    } catch {
      setFeedback({ kind: 'error', text: '登录时发生通信错误，请重试。' })
    } finally {
      if (loginSucceeded && !rememberPassword) setPassword('')
      setShowPassword(false)
      setLoggingIn(false)
      operationInProgress.current = false
    }
  }

  useEffect(() => {
    void handleStatusCheck()
  }, [])

  useEffect(() => {
    void window.campusLogin.getStartupSettings().then(setStartupSettings).catch(() => {})
    void window.campusLogin.getRememberedCredentials().then((saved) => {
      setPasswordStorageAvailable(saved.available)
      if (saved.credentials) {
        setUsername(saved.credentials.username)
        setPassword(saved.credentials.password)
        setRememberAccount(true)
        setRememberPassword(true)
        saveRememberedAccount(saved.credentials.username)
      }
      if (saved.message) setFeedback({ kind: 'warning', text: saved.message })
    }).catch(() => {
      setFeedback({ kind: 'warning', text: '无法读取密码设置，请手动输入密码。' })
    }).finally(() => setCredentialsLoading(false))
  }, [])

  const presentation = statusPresentation(result, internetStatus, checking, authenticatedAccount)
  const diagnostics = statusDiagnostics(result, internetStatus)
  const busy = checking || loggingIn || credentialsLoading || configSaving
  const authenticated = result?.ok && result.status === 'online'
  const displayName = accountDisplayName(authenticatedAccount)

  return (
    <>
    <WindowTitleBar settingsOpen={settingsOpen} onSettings={() => setSettingsOpen(true)} onMinimize={() => void handleMinimize()} onClose={() => void handleClose()} />
    <div className={`window-scenery${backgroundEnabled ? ' window-scenery--enabled' : ''}${customBackgroundUrl ? ' window-scenery--custom' : ''}`} aria-hidden="true">
      <img className="scene-day" src={dayScene} alt="" />
      <img className="scene-night" src={nightScene} alt="" />
      {customBackgroundUrl && <img className="scene-custom" src={customBackgroundUrl} alt="" />}
      <div className="scene-shade" />
    </div>
    <main className={`app-shell${backgroundEnabled && !customBackgroundUrl ? ' app-shell--scenic' : ''}`}>
      <header className="page-header">
        <div className="brand-mark" aria-hidden="true"><img src={avatar} alt="" /></div>
        <div>
          <p className="eyebrow">CAMPUSLOGIN · 校园网络助手</p>
          <h1>校园网连接</h1>
          <p className="page-subtitle">启动时检测一次，之后可手动更新状态。</p>
        </div>
      </header>

      <section className={`status-card status-card--${presentation.tone}`} aria-live="polite" aria-busy={checking}>
        <div className="status-topline">
          <p className="section-label">当前连接状态</p>
          <span className="status-badge"><span className="status-indicator" aria-hidden="true" />{statusLabels[presentation.tone]}</span>
        </div>
        <div className="status-main" key={`${presentation.tone}-${result?.checkedAt ?? 'initial'}`}>
          <div className="status-content">
            <h2>{presentation.title}</h2>
            <p className="status-description">{presentation.description}</p>
          </div>
          <div className="status-symbol" aria-hidden="true"><StatusGlyph tone={presentation.tone} /></div>
        </div>
        {!checking && (
          <div className="status-diagnostics">
            <p><span>校园网认证</span><strong>{diagnostics.campus}</strong></p>
            <p><span>互联网检测</span><strong>{diagnostics.internet}</strong></p>
          </div>
        )}
        {!checking && result && <p className="checked-at">上次检测 · {new Date(result.checkedAt).toLocaleString('zh-CN')}</p>}
      </section>

      {authenticated ? (
        <section key="completion" className="login-card completion-card" aria-labelledby="completion-heading">
          <p className="section-label">本次使用已就绪</p>
          <h2 id="completion-heading">{displayName ? `欢迎${displayName}` : '认证已完成'}</h2>
          <p>当前已连接校园网，无需再次登录。现在可以关闭应用。</p>
          <div className="actions">
            <button className="primary-button" type="button" onClick={() => void handleClose()}>完成并关闭</button>
            <button className="secondary-button" type="button" disabled={busy} onClick={() => void handleStatusCheck()}>
              {checking && <span className="button-spinner" aria-hidden="true" />}
              {checking ? '正在检测…' : '重新检测'}
            </button>
          </div>
          {feedback && <p key={feedback.text} role="status" className={`feedback feedback--${feedback.kind}`}>{feedback.text}</p>}
        </section>
      ) : (
      <section key="login" className="login-card" aria-labelledby="login-heading">
        <p className="section-label">仅在需要认证时登录</p>
        <h2 id="login-heading">账号登录</h2>
        <form onSubmit={(event) => void handleLogin(event)} autoComplete="off">
          <div className="field-grid">
            <div className="field">
              <label htmlFor="username">校园网账号</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(event) => handleUsernameChange(event.target.value)}
                disabled={busy}
                autoComplete="off"
                placeholder="请输入账号"
              />
            </div>
            <div className="field">
              <label htmlFor="password">密码</label>
              <div className="password-field">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={busy}
                  autoComplete="off"
                  placeholder="请输入密码"
                />
                <button
                  className="password-toggle"
                  type="button"
                  disabled={busy}
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                  aria-pressed={showPassword}
                  title={showPassword ? '隐藏密码' : '显示密码'}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M2.5 12s3.5-5 9.5-5 9.5 5 9.5 5-3.5 5-9.5 5-9.5-5-9.5-5Z" />
                    <circle cx="12" cy="12" r="2.5" />
                    {showPassword && <path d="M3 3l18 18" />}
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <div className="actions">
            <button className="primary-button" type="submit" disabled={busy}>
              {loggingIn && <span className="button-spinner" aria-hidden="true" />}
              {loggingIn ? '正在登录…' : '登录校园网'}
            </button>
            <button className="secondary-button" type="button" disabled={busy} onClick={() => void handleStatusCheck()}>
              {checking && <span className="button-spinner" aria-hidden="true" />}
              {checking ? '正在检测…' : '重新检测'}
            </button>
          </div>
        </form>
        {feedback && (
          <p key={feedback.text} role="status" className={`feedback feedback--${feedback.kind}`}>{feedback.text}</p>
        )}
      </section>
      )}
    </main>
    <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)}>
      <section className="settings-group" aria-labelledby="appearance-heading">
        <h3 id="appearance-heading">外观</h3>
        <div className="preferences">
          <label htmlFor="theme">主题模式</label>
          <select id="theme" value={theme} onChange={(event) => handleThemeChange(event.target.value as ThemePreference)}>
            <option value="system">跟随系统</option>
            <option value="light">浅色</option>
            <option value="dark">深色</option>
          </select>
        </div>
      </section>
      <section className="settings-group" aria-labelledby="background-heading">
        <h3 id="background-heading">背景</h3>
        <div className="background-options">
          <label className="background-switch"><input type="checkbox" checked={backgroundEnabled} onChange={(event) => handleBackgroundEnabled(event.target.checked)} /><span>显示背景图</span></label>
          <span className="background-source">{customBackground ? '自定义背景' : '昼夜小镇'}</span>
          <input ref={backgroundInput} className="background-file" type="file" accept="image/png,image/jpeg,image/webp" aria-label="选择自定义背景图片" onChange={(event) => { void handleCustomBackground(event.target.files?.[0] ?? null); event.target.value = '' }} />
          <button className="background-button" type="button" disabled={backgroundLoading || backgroundSaving} onClick={() => backgroundInput.current?.click()}>{backgroundSaving ? '正在保存…' : '自定义图片'}</button>
          {customBackground && <button className="background-button" type="button" disabled={backgroundSaving} onClick={() => void handleRestoreBackground()}>恢复内置</button>}
        </div>
      </section>
      <section className="settings-group" aria-labelledby="account-settings-heading">
        <h3 id="account-settings-heading">账号与密码</h3>
        <div className="remember-row">
          <label className="remember-account"><input type="checkbox" checked={rememberAccount} disabled={busy || rememberPassword} onChange={(event) => handleRememberAccountChange(event.target.checked)} /><span>记住账号</span></label>
          <label className="remember-account" title={passwordStorageAvailable ? '登录成功后保存，取消勾选会删除已保存的密码' : 'Windows 密码加密暂不可用'}><input type="checkbox" checked={rememberPassword} disabled={busy || !passwordStorageAvailable} onChange={(event) => void handleRememberPasswordChange(event.target.checked)} /><span>记住密码</span></label>
        </div>
        <p className="privacy-note">{rememberPassword ? '登录成功后加密保存密码，下次打开自动填入。' : '勾选“记住密码”可加密保存，否则仅用于本次登录。'}</p>
        <button className="clear-saved-info" type="button" disabled={busy} onClick={() => void handleClearSavedInfo()}>清除保存的账号和密码</button>
      </section>
      <section className="settings-group" aria-labelledby="startup-heading">
        <h3 id="startup-heading">启动</h3>
        <div className="startup-option">
        <label>
          <input
            type="checkbox"
            checked={startupSettings.enabled}
            disabled={!startupSettings.available || busy}
            onChange={(event) => void handleStartupChange(event.target.checked)}
          />
          <span>登录 Windows 时打开 CampusLogin</span>
        </label>
        {!startupSettings.available && <span>安装版可设置</span>}
        </div>
      </section>
      {feedback && <p role="status" className={`feedback feedback--${feedback.kind}`}>{feedback.text}</p>}
    </SettingsDialog>
    </>
  )
}
