import { useEffect, useRef, useState } from 'react'

// Arcade-dialogen en panelen (item 1336).

function useEscape(onClose) {
  useEffect(() => {
    if (!onClose) return
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
}

export function AcDialog({ title, tone = 'pink', onClose, children, actions }) {
  useEscape(onClose)
  return (
    <div className="ac-scrim" onMouseDown={e => { if (e.target === e.currentTarget) onClose?.() }}>
      <div className={`ac-dialog${tone === 'cyan' ? ' cyan' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <h3>{title}</h3>
        {children}
        {actions && <div className="ac-actions">{actions}</div>}
      </div>
    </div>
  )
}

// Bevestigen. danger=true: rode bevestigknop.
export function AcConfirm({ title, message, confirmLabel = 'OK', danger = false, onConfirm, onCancel }) {
  return (
    <AcDialog title={title} onClose={onCancel} tone={danger ? 'pink' : 'cyan'}
      actions={<>
        <button type="button" className="ac-btn" onClick={onCancel}>CANCEL</button>
        <button type="button" className={`ac-btn ${danger ? 'ac-btn--fill-danger' : 'ac-btn--primary'}`} onClick={onConfirm} autoFocus>{confirmLabel}</button>
      </>}>
      {message && <p className="ac-hint">{message}</p>}
    </AcDialog>
  )
}

// Tekst vragen (vervanger van window.prompt).
export function AcPrompt({ title, initial = '', confirmLabel = 'SAVE', onConfirm, onCancel }) {
  const [value, setValue] = useState(initial)
  const ref = useRef(null)
  useEffect(() => { ref.current?.select() }, [])
  const submit = e => { e.preventDefault(); if (value.trim()) onConfirm(value.trim()) }
  return (
    <AcDialog title={title} onClose={onCancel} tone="cyan">
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <input ref={ref} className="ac-input" value={value} onChange={e => setValue(e.target.value)} aria-label={title} />
        <div className="ac-actions">
          <button type="button" className="ac-btn" onClick={onCancel}>CANCEL</button>
          <button type="submit" className="ac-btn ac-btn--primary">{confirmLabel}</button>
        </div>
      </form>
    </AcDialog>
  )
}

// Paneel als zijlade (overlay) of inline. tabs: optionele <AcTabs> eronder.
export function AcPanel({ title, sub, tone = 'pink', onClose, tabs, footer, children, drawer = false, className = '' }) {
  useEscape(drawer ? onClose : null)
  const panel = (
    <section className={`ac-panel ${tone} ${drawer ? 'ac-drawer' : ''} ${className}`} aria-label={title}>
      <header>
        <h3 className="ac-h">{title}{sub && <em>{sub}</em>}</h3>
        {onClose && <button type="button" className="ac-icon" aria-label="Close" onClick={onClose}>✕</button>}
      </header>
      {tabs}
      <div className="ac-panel-body">{children}</div>
      {footer && <footer>{footer}</footer>}
    </section>
  )
  if (!drawer) return panel
  return (
    <>
      <div className="ac-scrim" style={{ background: 'rgba(7,1,26,.55)' }} onMouseDown={onClose} />
      {panel}
    </>
  )
}

// Korte melding onderin; verdwijnt na `ms`.
export function useAcToast(ms = 2400) {
  const [toast, setToast] = useState(null)
  const timer = useRef(null)
  function show(text, error = false) {
    clearTimeout(timer.current)
    setToast({ text, error })
    timer.current = setTimeout(() => setToast(null), ms)
  }
  const node = toast ? <div className={`ac-toast${toast.error ? ' error' : ''}`} role="status">{toast.text}</div> : null
  return [node, show]
}
