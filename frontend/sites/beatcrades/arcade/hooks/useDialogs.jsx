import { useState } from 'react'
import { AcConfirm, AcPrompt } from '@components/arcade/overlays.jsx'

// Promise-gebaseerde prompt/confirm met arcade-dialogen (item 1338), vervanger van classic .bc-dlg.
export function useDialogs() {
  const [dlg, setDlg] = useState(null)

  const ask = (title, initial = '') => new Promise(resolve => setDlg({ type: 'prompt', title, initial, resolve }))
  const confirm = (title, message, confirmLabel = 'DELETE', danger = true) =>
    new Promise(resolve => setDlg({ type: 'confirm', title, message, confirmLabel, danger, resolve }))

  const close = value => { dlg?.resolve(value); setDlg(null) }

  const node = !dlg ? null : dlg.type === 'prompt'
    ? <AcPrompt title={dlg.title} initial={dlg.initial} onConfirm={v => close(v)} onCancel={() => close(null)} />
    : <AcConfirm title={dlg.title} message={dlg.message} confirmLabel={dlg.confirmLabel} danger={dlg.danger}
        onConfirm={() => close(true)} onCancel={() => close(false)} />

  return { ask, confirm, node }
}
