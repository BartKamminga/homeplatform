import { useState, useEffect } from 'react'
import { getReportsModeration, getTimelineModeration } from '../../api.js'
import { stripFormatting } from '../../screens/FormattedText.jsx'
import ItemBar from '../blocks/ItemBar.jsx'
import useReportActions from '../blocks/useReportActions.js'
import useCustomPages, { SPOTLIGHT_PAGE } from '../pages/useCustomPages.js'
import ReportEditor from '../studio/ReportEditor.jsx'
import { STATUS_FILTERS, TYPE_LABEL, matchesFilters, newestFirst } from './reportFilters.js'

const select = { fontSize: 12, padding: '5px 8px', borderRadius: 8, border: '1px solid #ddd' }

// Berichten-overzicht in het beheer (item 1249, vervangt Algemene berichten):
// alle berichten van alle pagina's, met filters, en per bericht de balk.
// Toevoegen gebeurt op de pagina zelf (keuzebalk), niet hier.
export default function ReportsManager() {
  const [reports, setReports] = useState([])
  const [entries, setEntries] = useState([])
  const [filters, setFilters] = useState({ status: '', page: '', type: '', home: false, search: '' })
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')
  const customPages = useCustomPages()

  const load = () => getReportsModeration().then(setReports).catch(e => setError(e.message))
  useEffect(() => {
    load()
    getTimelineModeration().then(setEntries).catch(() => {})
  }, [])
  const actions = useReportActions(load)

  const pages = [SPOTLIGHT_PAGE, ...customPages]
  const pageLabel = ref => {
    if (ref?.startsWith('page:')) return pages.find(p => `page:${p.id}` === ref)?.label || 'Verwijderde pagina'
    return entries.find(e => e.match_ref === ref)?.title || 'Wedstrijd'
  }
  const set = key => e => setFilters(f => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  if (editingId) return <ReportEditor reportId={editingId} onDone={() => { setEditingId(null); load() }} />

  const shown = reports.filter(r => matchesFilters(r, filters, { pageLabel })).sort(newestFirst)

  return (
    <div>
      {actions.confirmDialog}
      <h3 style={{ fontSize: 15, margin: '0 0 4px' }}>Berichten</h3>
      <p style={{ fontSize: 12, color: '#999', margin: '0 0 10px' }}>
        Alle berichten van alle pagina&rsquo;s. Toevoegen doe je op de pagina zelf.
      </p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <input value={filters.search} onChange={set('search')} placeholder="Zoeken..." style={{ ...select, minWidth: 160 }} />
        <select value={filters.page} onChange={set('page')} style={select}>
          <option value="">Alle pagina&rsquo;s</option>
          <option value="matches">Wedstrijden</option>
          {pages.map(p => <option key={p.id} value={`page:${p.id}`}>{p.label}</option>)}
        </select>
        <select value={filters.status} onChange={set('status')} style={select}>
          {STATUS_FILTERS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <select value={filters.type} onChange={set('type')} style={select}>
          <option value="">Alle soorten</option>
          {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label style={{ fontSize: 12, display: 'flex', gap: 4, alignItems: 'center' }}>
          <input type="checkbox" checked={filters.home} onChange={set('home')} /> alleen op Home
        </label>
        <span style={{ fontSize: 12, color: '#888', marginLeft: 'auto' }}>{shown.length} van {reports.length}</span>
      </div>
      {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}
      {shown.map(r => {
        const onPage = r.match_ref?.startsWith('page:')
        return (
          <div key={r.id} style={{ marginBottom: 12 }}>
            <ItemBar label={r.title}
              live={r.status === 'published'} onToggleLive={() => actions.toggleLive(r)}
              featured={r.featured} onToggleFeatured={onPage ? () => actions.toggleFeatured(r) : undefined}
              onEdit={() => setEditingId(r.id)} onDelete={() => actions.remove(r)} />
            <div className="yof-card" onClick={() => setEditingId(r.id)}
              style={{ cursor: 'pointer', padding: '10px 14px', opacity: r.status === 'published' ? 1 : 0.5 }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>
                {pageLabel(r.match_ref)} &middot; {TYPE_LABEL[r.report_type] || r.report_type} &middot; {new Date(r.created_at).toLocaleDateString('nl-NL')}
              </div>
              <div style={{ fontSize: 13, color: '#444' }}>
                {(() => { const t = stripFormatting(r.body || ''); return t.length > 140 ? `${t.slice(0, 140)}...` : t || '(nog leeg)' })()}
              </div>
            </div>
          </div>
        )
      })}
      {shown.length === 0 && !error && <p style={{ fontSize: 13, color: '#666' }}>Geen berichten met deze filters.</p>}
    </div>
  )
}
