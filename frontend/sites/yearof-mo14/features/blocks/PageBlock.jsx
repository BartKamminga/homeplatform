import { useState } from 'react'
import usePageBlocks from './usePageBlocks.js'

// Een blok op een pagina dat live of concept kan staan (item 1239).
// - bezoekers: concept-blok wordt niet getoond;
// - beheerder op de site: concept-blok zichtbaar met gestippelde rand + label;
// - editMode (bewerkscherm in de beheerstudio): balk met de schakelaar.
// id moet ook in KNOWN_BLOCKS staan (backend page_blocks.py).
export default function PageBlock({ id, label, editMode = false, children }) {
  const access = usePageBlocks()
  const [busy, setBusy] = useState(false)
  const concept = access.conceptBlocks.has(id)

  if (!editMode) {
    if (!concept) return children
    if (!access.isPlatformAdmin) return null
    return (
      <div style={{ position: 'relative', outline: '2px dashed #cbd5e1', outlineOffset: 4, borderRadius: 14, marginBottom: 18 }}>
        <ConceptBadge />
        {children}
      </div>
    )
  }

  async function toggle() {
    setBusy(true)
    try { await access.setBlockState(id, concept) } finally { setBusy(false) }
  }

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', marginBottom: 6, borderRadius: 10, background: concept ? '#f1f2f5' : '#dcfce7', fontSize: 12 }}>
        <strong style={{ flex: 1 }}>{label}</strong>
        <span style={{ color: concept ? '#6b7280' : '#166534', fontWeight: 700 }}>{concept ? 'Concept - alleen jij' : 'Live'}</span>
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

function ConceptBadge() {
  return (
    <span style={{
      position: 'absolute', top: -10, left: 12, zIndex: 1, background: 'white', border: '1px dashed #6b7280',
      color: '#6b7280', fontSize: 10, fontWeight: 800, padding: '1px 8px', borderRadius: 999, letterSpacing: '.05em',
    }}>CONCEPT</span>
  )
}
