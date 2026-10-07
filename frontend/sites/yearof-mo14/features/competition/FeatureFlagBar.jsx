import { useState } from 'react'

// Balk voor de platformbeheerder bovenaan de tabs Competitie en Topklasse
// (items 1229-1232): toont of de tabs al voor bezoekers zichtbaar zijn en
// laat ze vrijgeven/verbergen. 1 schakelaar voor beide tabs.
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
          ? 'Competitie en Topklasse zijn zichtbaar voor alle bezoekers'
          : 'Competitie en Topklasse zijn alleen zichtbaar voor jou (beheerder) - nog niet vrijgegeven'}
      </strong>
      <button onClick={toggle} disabled={busy} className="yof-btn-secondary" style={{ background: 'white' }}>
        {config.public ? 'Weer verbergen' : 'Vrijgeven voor bezoekers'}
      </button>
    </div>
  )
}
