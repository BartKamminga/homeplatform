import { useState } from 'react'
import PublicSpotlight from '../../screens/PublicSpotlight.jsx'
import ItemBar from '../blocks/ItemBar.jsx'
import AddBar from '../blocks/AddBar.jsx'
import useReportActions from '../blocks/useReportActions.js'
import ReportEditor from './ReportEditor.jsx'

// "In de kijker" in de beheerstudio (item 1239): dezelfde lijst als op de site,
// plus concepten; per bericht de balk (live/concept, In de kijker, bewerken,
// verwijderen) en onderaan de keuzebalk.
export default function SpotlightAdmin({ initialReportId, onOpenMatch }) {
  const [editingId, setEditingId] = useState(initialReportId || null)
  const [listKey, setListKey] = useState(0)
  const reload = () => setListKey(k => k + 1)
  const actions = useReportActions(reload)

  if (editingId) return <ReportEditor reportId={editingId} onDone={() => { setEditingId(null); reload() }} />

  return (
    <div>
      {actions.confirmDialog}
      <PublicSpotlight key={listKey} adminMode adminList onOpenMatch={onOpenMatch}
        onEditReport={r => setEditingId(r.id)}
        renderBar={r => (
          <ItemBar label={r.title}
            live={r.status === 'published'} onToggleLive={() => actions.toggleLive(r)}
            featured={r.featured} onToggleFeatured={r.report_type === 'nieuws' ? undefined : () => actions.toggleFeatured(r)}
            onEdit={() => setEditingId(r.id)} onDelete={() => actions.remove(r)} />
        )} />
      <AddBar kinds={['self']} onPick={() => actions.createNews()} />
      <p style={{ fontSize: 12, color: '#999', margin: '4px 0 0' }}>
        Nieuws staat altijd in de kijker; verslagen en interviews van een wedstrijd zet je erin met &#9733; In de kijker.
      </p>
    </div>
  )
}
