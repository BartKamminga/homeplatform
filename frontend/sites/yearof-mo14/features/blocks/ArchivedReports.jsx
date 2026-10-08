import { useState } from 'react'
import ItemBar from './ItemBar.jsx'

// Archief van een pagina in het bewerkscherm (item 1239): gearchiveerde
// berichten, dichtgeklapt, met Terugzetten (komt als concept terug).
export default function ArchivedReports({ reports, onRestore }) {
  const [open, setOpen] = useState(false)
  if (reports.length === 0) return null
  return (
    <div style={{ marginTop: 10 }}>
      <button onClick={() => setOpen(o => !o)} className="yof-btn-secondary">
        {open ? 'Archief verbergen' : `Archief (${reports.length})`}
      </button>
      {open && (
        <div style={{ marginTop: 8, opacity: 0.85 }}>
          {reports.map(r => (
            <ItemBar key={r.id} label={`${r.title} - gearchiveerd ${new Date(`${r.archived_at}Z`).toLocaleDateString('nl-NL')}`}
              onRestore={() => onRestore(r)} />
          ))}
        </div>
      )}
    </div>
  )
}
