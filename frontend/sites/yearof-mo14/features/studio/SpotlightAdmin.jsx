import { useState } from 'react'
import PublicSpotlight from '../../screens/PublicSpotlight.jsx'
import ReportEditor from './ReportEditor.jsx'

// "In de kijker" in de beheerstudio (item 1239): precies dezelfde lijst als
// op de site, klik op een bericht = hier bewerken.
export default function SpotlightAdmin({ initialReportId, onOpenMatch }) {
  // null | { id } (id leeg = nieuw); initialReportId = geklikt in de preview
  const [editing, setEditing] = useState(initialReportId ? { id: initialReportId } : null)

  if (editing) return <ReportEditor reportId={editing.id} onDone={() => setEditing(null)} />

  return (
    <div>
      <PublicSpotlight adminMode onEditReport={r => setEditing({ id: r.id })} onOpenMatch={onOpenMatch} />
      <button onClick={() => setEditing({ id: null })} className="yof-btn" style={{ marginTop: 12 }}>
        + Bericht toevoegen
      </button>
      <p style={{ fontSize: 12, color: '#999', margin: '8px 0 0' }}>
        Hier staan de gepubliceerde berichten die in de kijker staan, plus al het nieuws. Concepten vind je onder Algemene berichten of bij de wedstrijd.
      </p>
    </div>
  )
}
