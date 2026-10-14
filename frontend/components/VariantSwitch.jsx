import { useState } from 'react'
import { setVariant } from '@core/uiVariant.js'

// Schakelaar classic/arcade voor in de classic-UI (item 1336). Arcade heeft een eigen variant (AcVariantSwitch).
export default function VariantSwitch({ site, current = 'classic' }) {
  const [busy, setBusy] = useState(false)

  function pick(value) {
    if (value === current || busy) return
    setBusy(true)
    setVariant(site, value)
  }

  const btn = active => ({
    flex: 1, padding: '7px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
    background: active ? 'var(--color-primary, #7c3aed)' : 'transparent',
    color: active ? 'var(--color-on-primary, #fff)' : 'var(--color-text-muted, #888)',
  })

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontSize: 13 }}>Interface</span>
      <div style={{ display: 'flex', minWidth: 180, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--color-border, #333)' }}>
        <button type="button" style={btn(current === 'classic')} onClick={() => pick('classic')}>Classic</button>
        <button type="button" style={btn(current === 'arcade')} onClick={() => pick('arcade')}>Arcade</button>
      </div>
    </div>
  )
}
