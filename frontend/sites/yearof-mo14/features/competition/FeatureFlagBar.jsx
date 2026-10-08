import { useState } from 'react'

// Schakelaar live/concept voor de tabs Competitie en Topklasse (items
// 1229-1232), alleen in het bewerkscherm van de beheerstudio (item 1239).
// Elke tab een eigen schakelaar (page: 'competition' | 'topklasse').
const PAGE_NAME = { competition: 'Competitie', topklasse: 'Topklasse' }

export default function FeatureFlagBar({ access, page }) {
  const { config, isPlatformAdmin, setPublic } = access
  const [busy, setBusy] = useState(false)
  if (!isPlatformAdmin || !config) return null
  const live = page === 'topklasse' ? config.topklasse_public : config.public

  async function toggle() {
    setBusy(true)
    try { await setPublic(page, !live) } finally { setBusy(false) }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 12px', marginBottom: 12,
      borderRadius: 10, fontSize: 12, background: live ? '#dcfce7' : '#fde68a', color: '#12203c',
    }}>
      <strong style={{ flex: 1 }}>
        {live
          ? `Live - ${PAGE_NAME[page]} staat in het menu voor alle bezoekers`
          : `Concept - ${PAGE_NAME[page]} is nog nergens op de site te zien`}
      </strong>
      <button onClick={toggle} disabled={busy} className="yof-btn-secondary" style={{ background: 'white' }}>
        {live ? 'Naar concept' : 'Live zetten'}
      </button>
    </div>
  )
}
