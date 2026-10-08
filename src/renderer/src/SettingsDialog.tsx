import { useEffect, useRef, type ReactNode } from 'react'

export default function SettingsDialog({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const element = dialog.current
    if (open && element && !element.open) element.showModal()
    if (!open && element?.open) element.close()
  }, [open])

  return (
    <dialog ref={dialog} className="settings-dialog" aria-labelledby="settings-heading" onCancel={onClose} onClose={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="settings-content">
        <header className="settings-header">
          <h2 id="settings-heading">设置</h2>
          <button className="settings-close" type="button" aria-label="关闭设置" autoFocus onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </header>
        {children}
      </div>
    </dialog>
  )
}
