import { useState } from 'react'

// Schakelaar live/concept voor de tabs Competitie en Topklasse (items
// 1229-1232), alleen in het bewerkscherm van de beheerstudio (item 1239).
// 1 schakelaar voor beide tabs.
export default function FeatureFlagBar({ access }) {
  const { config, isPlatformAdmin, setPublic } = access
  const [busy, setBusy] = useState(false)
  if (!isPlatformAdmin || !config) return null

  async function toggle() {
    setBusy(true)
    try { await setPublic(!config.public) } finally { setBusy(false) }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 12px', marginBottom: 12,
      borderRadius: 10, fontSize: 12, background: config.public ? '#dcfce7' : '#fde68a', color: '#12203c',
    }}>
      <strong style={{ flex: 1 }}>
        {config.public
          ? 'Live - Competitie en Topklasse staan in het menu voor alle bezoekers'
          : 'Concept - Competitie en Topklasse zijn nog nergens op de site te zien'}
      </strong>
      <button onClick={toggle} disabled={busy} className="yof-btn-secondary" style={{ background: 'white' }}>
        {config.public ? 'Naar concept' : 'Live zetten'}
      </button>
    </div>
  )
}
