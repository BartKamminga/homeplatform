import { useState } from 'react'
import usePageBlocks from './usePageBlocks.js'

// Live/concept voor een hele pagina in het menu (item 1239). Concept = de tab
// staat nergens in het menu. Zelfde opslag als de blokken: id "page.<view>".
// sectie in de studio -> pagina (view-naam in PublicSite) + naam
export const PAGES = {
  actie: { id: 'page.action', label: 'Actie' },
  kijker: { id: 'page.spotlight', label: 'In de kijker' },
  spelers: { id: 'page.team', label: 'Team' },
  wedstrijden: { id: 'page.timeline', label: 'Wedstrijden' },
  fotos: { id: 'page.upload', label: "Foto's toevoegen" },
}

export default function PageSwitch({ id, label }) {
  const { conceptBlocks, isPlatformAdmin, setBlockState } = usePageBlocks()
  const [busy, setBusy] = useState(false)
  const concept = conceptBlocks.has(id)

  async function toggle() {
    setBusy(true)
    try { await setBlockState(id, concept) } finally { setBusy(false) }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 12px', marginBottom: 14,
      borderRadius: 10, fontSize: 12, background: concept ? '#fde68a' : '#dcfce7', color: '#12203c',
    }}>
      <strong style={{ flex: 1 }}>
        {concept ? `Concept - pagina ${label} staat niet in het menu` : `Live - pagina ${label} staat in het menu`}
      </strong>
      {isPlatformAdmin && (
        <button onClick={toggle} disabled={busy} className="yof-btn-secondary" style={{ background: 'white' }}>
          {concept ? 'Live zetten' : 'Naar concept'}
        </button>
      )}
    </div>
  )
}
