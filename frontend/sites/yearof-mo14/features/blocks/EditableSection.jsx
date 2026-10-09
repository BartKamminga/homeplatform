import { useState } from 'react'

// Onderdeel van een editor dat eerst toont zoals op de site, met Bewerken naar
// het standaard bewerk-component van dat type content en Klaar terug (item 1258).
// Afspraak: per type content altijd dezelfde tonen- en bewerk-componenten.
export default function EditableSection({ label, show, edit, empty = 'Nothing yet.', isEmpty = false, onDone }) {
  const [editing, setEditing] = useState(false)
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <strong style={{ fontSize: 13 }}>{label}</strong>
        <button onClick={() => { if (editing) onDone?.(); setEditing(e => !e) }} className="yof-btn-secondary" style={{ fontSize: 12 }}>
          {editing ? 'Done' : '✎ Edit'}
        </button>
      </div>
      {editing ? edit : isEmpty ? <p style={{ margin: 0, fontSize: 13, color: '#888' }}>{empty}</p> : show}
    </div>
  )
}
