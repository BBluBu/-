import avatar from './assets/cartman-avatar.jpg'

interface Props {
  settingsOpen: boolean
  onSettings: () => void
  onMinimize: () => void
  onClose: () => void
}

export default function WindowTitleBar({ settingsOpen, onSettings, onMinimize, onClose }: Props) {
  return (
    <header className="window-titlebar" aria-label="窗口标题栏">
      <div className="window-brand"><img src={avatar} alt="" draggable={false} /><span>CampusLogin</span></div>
      <div className="window-controls">
        <button className="window-control settings-button" type="button" aria-label="打开设置" title="设置" aria-haspopup="dialog" aria-expanded={settingsOpen} onClick={onSettings}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 3-.5 2.2-2 .9-2-.6-2 3.5 1.6 1.6v2.8l-1.6 1.6 2 3.5 2-.6 2 .9L9 21h6l.5-2.2 2-.9 2 .6 2-3.5-1.6-1.6v-2.8L21.5 9l-2-3.5-2 .6-2-.9L15 3Z" /><circle cx="12" cy="12" r="3" /></svg>
        </button>
        <button className="window-control" type="button" aria-label="最小化窗口" title="最小化" onClick={onMinimize}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M6 12h12" /></svg>
        </button>
        <button className="window-control window-control--close" type="button" aria-label="关闭窗口" title="关闭" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17" /></svg>
        </button>
      </div>
    </header>
  )
}
