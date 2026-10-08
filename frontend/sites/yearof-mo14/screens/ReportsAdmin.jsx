import { useState, useEffect, useRef } from 'react'
import { getPlayers, getReportsModeration, tagReport, untagReport } from '../api.js'
import { LinkTiles } from './ReportLinks.jsx'
import { ReportForm } from './ReportForm.jsx'
import FormattedText from './FormattedText.jsx'
import ItemBar from '../features/blocks/ItemBar.jsx'
import AddBar from '../features/blocks/AddBar.jsx'
import useReportActions from '../features/blocks/useReportActions.js'

// Zelfde kaart-stijl/klik-om-te-bewerken-patroon als de wedstrijdpagina's
// (PublicEntry in adminMode) - WYSIWYG, alleen voor niet-wedstrijd-gebonden
// berichten. Wedstrijdverslagen/interviews/linkjes horen bij de wedstrijd
// en worden daar bewerkt (MatchAdminDetail).
function AlgemeenReportCard({ report, onEdit }) {
  return (
    <div className="yof-card" onClick={() => onEdit(report)}
      style={{ marginBottom: 10, position: 'relative', cursor: 'pointer', opacity: report.status === 'concept' ? 0.5 : 1 }}>
      <h4 style={{ margin: '0 0 4px', fontSize: 15 }}>{report.title}</h4>
      {report.author_name && <p style={{ margin: '0 0 4px', fontSize: 12, color: '#666' }}>door {report.author_name}</p>}
      <p style={{ margin: '0 0 4px', fontSize: 11, color: '#999' }}>
        Aangemaakt: {new Date(report.created_at).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })}
        {report.published_at && (
          <> &middot; Gepubliceerd: {new Date(report.published_at).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })}</>
        )}
      </p>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}><FormattedText text={report.body} /></p>
      <LinkTiles links={report.links} />
    </div>
  )
}

export default function ReportsAdmin({ initialEditId }) {
  const [players, setPlayers] = useState([])
  const [reports, setReports] = useState([])
  const [view, setView] = useState('list') // list | edit
  const [editingReport, setEditingReport] = useState(null)
  const [error, setError] = useState('')
  // Consumeert initialEditId precies 1x (bv. vanuit de Bekijk site-preview,
  // item 1155/1156) - anders zou elke latere loadReports() na "terug naar
  // lijst" opnieuw naar de edit-view springen.
  const pendingInitialEditId = useRef(initialEditId || null)
  // Balk per bericht en keuzebalk, zelfde werkwijze als overal (item 1239).
  const actions = useReportActions(() => loadReports())

  function loadReports() {
    getReportsModeration()
      .then(rows => {
        const general = rows.filter(r => !r.match_ref)
        setReports(general)
        if (pendingInitialEditId.current) {
          const found = general.find(r => r.id === pendingInitialEditId.current)
          pendingInitialEditId.current = null
          if (found) { setEditingReport(found); setView('edit') }
        }
      })
      .catch(e => setError(e.message))
  }
  useEffect(() => {
    loadReports()
    getPlayers().then(setPlayers).catch(() => {})
  }, [])

  function backToList() {
    setEditingReport(null)
    setView('list')
    loadReports()
  }

  async function toggleEditingReportTag(playerId) {
    if (!editingReport) return
    const tagged = (editingReport.player_ids || []).includes(playerId)
    if (tagged) await untagReport(editingReport.id, playerId)
    else await tagReport(editingReport.id, playerId)
    await refreshEditingReport()
  }

  async function refreshEditingReport() {
    if (!editingReport) return
    const fresh = await getReportsModeration()
    const updated = fresh.find(r => r.id === editingReport.id)
    if (updated) setEditingReport(updated)
    setReports(fresh.filter(r => !r.match_ref))
  }

  return (
    <div>
      {view === 'edit' && editingReport && (
        <ReportForm
          existingReport={editingReport} players={players} onToggleTag={toggleEditingReportTag} controlsOnBar
          onSaved={backToList} onCancel={backToList} onDeleted={backToList} onRefresh={refreshEditingReport}
        />
      )}
      {view === 'list' && (
        <>
          <h3 style={{ fontSize: 15, margin: '0 0 4px' }}>Algemene berichten</h3>
          <p style={{ fontSize: 12, color: '#999', margin: '0 0 14px' }}>
            Niet aan een wedstrijd gebonden - deze komen op In de kijker of de Parijs-weekend-pagina te staan.
            Wedstrijdverslagen, interviews en linkjes bij een wedstrijd bewerk je via de wedstrijdpagina zelf.
          </p>
          {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}
          {actions.confirmDialog}
          {reports.map(r => (
            <div key={r.id}>
              <ItemBar label={r.title}
                live={r.status === 'published'} onToggleLive={() => actions.toggleLive(r)}
                featured={r.featured} onToggleFeatured={r.report_type === 'nieuws' ? undefined : () => actions.toggleFeatured(r)}
                onEdit={() => { setEditingReport(r); setView('edit') }} onDelete={() => actions.remove(r)} />
              <AlgemeenReportCard report={r} onEdit={rep => { setEditingReport(rep); setView('edit') }} />
            </div>
          ))}
          {reports.length === 0 && !error && <p style={{ color: '#666', fontSize: 13 }}>Nog geen algemene berichten.</p>}
          <AddBar kinds={['self']} onPick={() => actions.createNews()} />
        </>
      )}
    </div>
  )
}
