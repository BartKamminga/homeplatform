import { useState } from 'react'

// navigator.clipboard bestaat alleen in secure contexts (HTTPS/localhost) -
// acc draait over plain HTTP op een LAN-IP, dus navigator.clipboard is daar
// undefined. Fallback op de oudere execCommand('copy')-route via een
// tijdelijke textarea. Gepromoveerd naar @components (item 1053, was eerder
// losstaand gedupliceerd in mindbox/utils.js en admin/pages/Roadmap.jsx).
export function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text)
  }
  return new Promise((resolve, reject) => {
    const el = document.createElement('textarea')
    el.value = text
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.focus()
    el.select()
    try {
      const ok = document.execCommand('copy')
      document.body.removeChild(el)
      ok ? resolve() : reject(new Error("execCommand('copy') gaf false terug"))
    } catch (e) {
      document.body.removeChild(el)
      reject(e)
    }
  })
}

const baseStyle = {
  padding: '4px 8px', fontSize: 12, borderRadius: 6, border: '1px solid var(--color-border)',
  background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
}

// Generieke kopieerknop met korte "Gekopieerd!"-feedback - vervangt de
// per-pagina copyMsg-state + handleCopy die eerder los in ItemsPage/
// CasesPage stonden (item 1053). `label` (optioneel) toont de gekopieerde
// tekst zelf naast het icoon, monospace - gebruikt voor de commando-
// notatie; zonder `label` is het een kale icoonknop (bv. downloaden,
// response-tekst kopiëren).
export default function CopyButton({ text, label, title, icon = '⧉', mono = false, style }) {
  const [msg, setMsg] = useState('')

  function handleClick() {
    copyText(text)
      .then(() => { setMsg('Gekopieerd!'); setTimeout(() => setMsg(''), 1500) })
      .catch(() => setMsg('Mislukt'))
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <button
        onClick={handleClick}
        title={title || text}
        style={{ ...baseStyle, ...(mono ? { fontFamily: 'monospace' } : {}), ...style }}
      >
        {icon}{label ? ` ${label}` : ''}
      </button>
      {msg && <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{msg}</span>}
    </span>
  )
}
