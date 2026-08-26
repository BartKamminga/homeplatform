import { useState } from 'react'

// Standaard bevestigingsdialoog voor het hele platform (item 760, gepromoveerd
// naar @components zodat elke site 'm kan gebruiken i.p.v. window.confirm() of
// een eigen variant - zie item 956/agent-control voor de aanleiding).
const cancelBtnStyle = {
  padding: '6px 12px', borderRadius: 8, fontSize: 12, background: 'var(--color-surface)',
  border: '1px solid var(--color-border)', color: 'var(--color-text)', cursor: 'pointer', fontFamily: 'inherit',
}

export function ConfirmDialog({ open, children, confirmLabel = 'Ja', cancelLabel = 'Nee', danger = true, busy = false, onConfirm, onCancel }) {
  if (!open) return null
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={e => e.target === e.currentTarget && onCancel()}
    >
      <div style={{ background: 'var(--color-surface)', borderRadius: 14, padding: '20px 22px', width: '100%', maxWidth: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
        <div style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 18 }}>{children}</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={cancelBtnStyle}>{cancelLabel}</button>
          <button onClick={onConfirm} disabled={busy} style={{
            padding: '7px 14px', borderRadius: 8, fontSize: 13, cursor: busy ? 'default' : 'pointer',
            border: 'none', fontFamily: 'inherit', fontWeight: 600,
            background: danger ? 'var(--color-danger)' : 'var(--color-primary)', color: '#fff',
            opacity: busy ? 0.6 : 1,
          }}>{busy ? 'Bezig…' : confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

// Promise-gebaseerde variant voor imperatieve call-sites die voorheen
// `window.confirm(msg)` gebruikten: `if (!await confirm('...?')) return`.
// Render `dialog` ergens in de component-tree van de aanroeper.
export function useConfirm() {
  const [pending, setPending] = useState(null) // { message, resolve }

  function confirm(message) {
    return new Promise(resolve => setPending({ message, resolve }))
  }

  function handle(result) {
    pending?.resolve(result)
    setPending(null)
  }

  const dialog = (
    <ConfirmDialog open={!!pending} onConfirm={() => handle(true)} onCancel={() => handle(false)}>
      {pending?.message}
    </ConfirmDialog>
  )

  return [confirm, dialog]
}
