import { useState } from 'react'
import usePageBlocks from './usePageBlocks.js'

// Een blok op een pagina dat live of concept kan staan (item 1239).
// - site en preview (ook voor de beheerder): concept-blok wordt niet getoond -
//   zo min mogelijk verschil tussen wat de beheerder en bezoekers zien;
// - editMode (bewerkscherm in de beheerstudio): balk met de schakelaar.
// id moet ook in KNOWN_BLOCKS staan (backend page_blocks.py).
export default function PageBlock({ id, label, editMode = false, children }) {
  const access = usePageBlocks()
  const [busy, setBusy] = useState(false)
  const concept = access.conceptBlocks.has(id)

  if (!editMode) return concept ? null : children

  async function toggle() {
    setBusy(true)
    try { await access.setBlockState(id, concept) } finally { setBusy(false) }
  }

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', marginBottom: 6, borderRadius: 10, background: concept ? '#f1f2f5' : '#dcfce7', fontSize: 12 }}>
        <strong style={{ flex: 1 }}>{label}</strong>
        <span style={{ color: concept ? '#6b7280' : '#166534', fontWeight: 700 }}>{concept ? 'Concept - niet op de site' : 'Live'}</span>
        {access.isPlatformAdmin && (
          <button onClick={toggle} disabled={busy} className="yof-btn-secondary" style={{ background: 'white' }}>
            {concept ? 'Live zetten' : 'Naar concept'}
          </button>
        )}
      </div>
      <div style={{ opacity: concept ? 0.5 : 1 }}>{children}</div>
    </div>
  )
}
