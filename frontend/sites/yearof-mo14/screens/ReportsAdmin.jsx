import { useState, useEffect } from 'react'
import { getPlayers, getReportsModeration, tagReport, untagReport } from '../api.js'
import { LinkTiles } from './ReportLinks.jsx'
import { ReportForm } from './ReportForm.jsx'

// Zelfde kaart-stijl/klik-om-te-bewerken-patroon als de wedstrijdpagina's
// (PublicEntry in adminMode) - WYSIWYG, alleen voor niet-wedstrijd-gebonden
// berichten. Wedstrijdverslagen/interviews/linkjes horen bij de wedstrijd
// en worden daar bewerkt (MatchAdminDetail).
function AlgemeenReportCard({ report, onEdit }) {
  return (
    <div className="yof-card" onClick={() => onEdit(report)} style={{ marginBottom: 10, position: 'relative', cursor: 'pointer' }}>
      {(report.status === 'concept' || report.featured) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          {report.status === 'concept' && (
            <span style={{ background: '#fde68a', color: '#92400e', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>
              CONCEPT
            </span>
          )}
          {report.featured && (
            <span style={{ fontSize: 11, color: '#a3245c', fontWeight: 700 }}>&#9733; In de kijker</span>
          )}
        </div>
      )}
      <span style={{ position: 'absolute', top: 10, right: 10, fontSize: 11, color: '#999' }}>&#9998; bewerken</span>
      <h4 style={{ margin: '0 0 4px', fontSize: 15 }}>{report.title}</h4>
      {report.author_name && <p style={{ margin: '0 0 4px', fontSize: 12, color: '#666' }}>door {report.author_name}</p>}
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{report.body}</p>
      <LinkTiles links={report.links} />
    </div>
  )
}

export default function ReportsAdmin() {
  const [players, setPlayers] = useState([])
  const [reports, setReports] = useState([])
  const [view, setView] = useState('list') // list | write | edit
  const [editingReport, setEditingReport] = useState(null)
  const [error, setError] = useState('')

  function loadReports() {
    getReportsModeration()
      .then(rows => setReports(rows.filter(r => !r.match_ref)))
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
    const fresh = await getReportsModeration()
    const updated = fresh.find(r => r.id === editingReport.id)
    if (updated) setEditingReport(updated)
    setReports(fresh.filter(r => !r.match_ref))
  }

  return (
    <div>
      {view === 'write' && (
        <ReportForm defaultReportType="nieuws" onSaved={backToList} onCancel={() => setView('list')} />
      )}
      {view === 'edit' && editingReport && (
        <ReportForm
          existingReport={editingReport} players={players} onToggleTag={toggleEditingReportTag}
          onSaved={backToList} onCancel={backToList} onDeleted={backToList}
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
          {reports.map(r => (
            <AlgemeenReportCard key={r.id} report={r} onEdit={rep => { setEditingReport(rep); setView('edit') }} />
          ))}
          {reports.length === 0 && !error && <p style={{ color: '#666', fontSize: 13 }}>Nog geen algemene berichten.</p>}
          <button onClick={() => setView('write')} className="yof-btn" style={{ width: '100%', marginTop: 4 }}>
            + Algemeen bericht toevoegen
          </button>
        </>
      )}
    </div>
  )
}
