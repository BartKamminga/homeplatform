// Keuzebalk "iets toevoegen" (item 1239): een keuze maakt meteen een blok aan
// (als concept); invullen gaat daarna via Bewerken op het blok. Overal gelijk.
export const ADD_OPTIONS = {
  self: { label: '✎ Zelf schrijven' },
  invite_report: { label: '✉ Invullink verslag' },
  invite_photos: { label: '📷 Invullink foto\'s' },
  instagram: { label: 'Instagram' },
  footage: { label: '▶ Wedstrijdbeelden' },
}

export default function AddBar({ kinds = Object.keys(ADD_OPTIONS), onPick, compact = false }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'center',
      padding: compact ? '2px 0 8px' : '10px 12px', margin: compact ? 0 : '6px 0 12px',
      border: compact ? 'none' : '1px dashed #cbd5e1', borderRadius: 12,
    }}>
      <span style={{ fontSize: 12, color: '#888' }}>+ Toevoegen:</span>
      {kinds.map(k => (
        <button key={k} onClick={() => onPick(k)} className="yof-btn-secondary" style={{ background: 'white' }}>
          {ADD_OPTIONS[k].label}
        </button>
      ))}
    </div>
  )
}
