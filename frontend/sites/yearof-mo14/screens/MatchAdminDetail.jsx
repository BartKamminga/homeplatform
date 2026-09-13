import { useState, useEffect } from 'react'
import {
  getTimeline, getTimelineItem, getPlayers,
  getReportsModeration, updateReport, deleteReport, tagReport, untagReport, createReportDirect,
  getPhotosModeration, updatePhoto, deletePhoto, tagPhoto, untagPhoto,
  createContributorLink, listContributorLinks,
  getMatchGoals, setMatchGoal,
} from '../api.js'
import { copyToClipboard } from '../clipboard.js'
import { contributorLinkStatus } from '../linkStatus.js'
import { ReportCard } from './ReportsAdmin.jsx'
import { PhotoCard } from './PhotosAdmin.jsx'
import { defaultNewLinks, NewLinksEditor } from './ReportLinks.jsx'
import PublicEntry from './PublicEntry.jsx'

function NewMessageLinks({ matchRef, players, links, onCreated }) {
  const [playerId, setPlayerId] = useState('')
  const [reportType, setReportType] = useState('wedstrijdverslag')
  const [error, setError] = useState('')
  const [copiedId, setCopiedId] = useState('')

  function playerName(id) {
    return players.find(p => p.id === id)?.nickname || players.find(p => p.id === id)?.name || '-'
  }

  async function make() {
    try {
      const link = await createContributorLink({ match_ref: matchRef, player_id: playerId || null, report_type: reportType, expires_days: 14 })
      window.open(`${window.location.origin}/yearof-mo14/?invul=${link.id}`, '_blank')
      onCreated()
    } catch (e) {
      setError(e.message)
    }
  }

  async function copy(link) {
    const url = `${window.location.origin}/yearof-mo14/?invul=${link.id}`
    try {
      await copyToClipboard(url)
      setCopiedId(link.id)
      setTimeout(() => setCopiedId(''), 2000)
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div>
      {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <select value={reportType} onChange={e => setReportType(e.target.value)} style={{ fontSize: 12 }}>
          <option value="wedstrijdverslag">Wedstrijdverslag</option>
          <option value="interview">Interview</option>
        </select>
        <select value={playerId} onChange={e => setPlayerId(e.target.value)} style={{ fontSize: 12 }}>
          <option value="">Voor het hele team / mezelf</option>
          {players.map(p => <option key={p.id} value={p.id}>{p.nickname || p.name}</option>)}
        </select>
        <button onClick={make} style={{ fontSize: 12, cursor: 'pointer' }}>Nieuw bericht (opent invulpagina)</button>
      </div>

      {links.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: '#888' }}>
              <th style={{ padding: 6 }}>Speler</th>
              <th style={{ padding: 6 }}>Type</th>
              <th style={{ padding: 6 }}>Status</th>
              <th style={{ padding: 6 }}>Link</th>
              <th style={{ padding: 6 }}></th>
            </tr>
          </thead>
          <tbody>
            {links.map(l => {
              const status = contributorLinkStatus(l)
              const url = `${window.location.origin}/yearof-mo14/?invul=${l.id}`
              return (
                <tr key={l.id} style={{ borderTop: '1px solid #eee' }}>
                  <td style={{ padding: 6 }}>{l.player_id ? playerName(l.player_id) : 'team'}</td>
                  <td style={{ padding: 6 }}>{l.report_type}</td>
                  <td style={{ padding: 6, color: status.color, fontWeight: 600 }}>{status.label}</td>
                  <td style={{ padding: 6, width: 200 }}>
                    <input readOnly value={url} onFocus={e => e.target.select()}
                      style={{ width: '100%', boxSizing: 'border-box', fontSize: 11, padding: '4px 6px', borderRadius: 6, border: '1px solid #ddd' }} />
                  </td>
                  <td style={{ padding: 6 }}>
                    <button onClick={() => copy(l)} style={{ fontSize: 11, cursor: 'pointer' }}>
                      {copiedId === l.id ? 'Gekopieerd!' : 'Kopieer'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

function NewMatchFootage({ matchRef, existingReport, onCreated }) {
  const [links, setLinks] = useState(defaultNewLinks())
  const [error, setError] = useState('')

  if (existingReport) {
    return (
      <p style={{ color: '#666', fontSize: 13 }}>
        Er staat al een Wedstrijdbeelden-bericht voor deze wedstrijd - bewerk de linkjes hierboven.
      </p>
    )
  }

  async function submit() {
    try {
      await createReportDirect({
        match_ref: matchRef,
        report_type: 'wedstrijd_beelden',
        title: 'Wedstrijdbeelden',
        body: '',
        status: 'published',
        links,
      })
      setLinks(defaultNewLinks())
      onCreated()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div>
      {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}
      <NewLinksEditor links={links} onChange={setLinks} />
      <button onClick={submit} style={{ fontSize: 12, cursor: 'pointer' }}>Toevoegen</button>
    </div>
  )
}

function GoalsPanel({ matchRef, players }) {
  const [goals, setGoals] = useState({})
  const [saving, setSaving] = useState('')

  useEffect(() => {
    getMatchGoals(matchRef).then(rows => {
      const map = {}
      rows.forEach(r => { map[r.player_id] = r.goals })
      setGoals(map)
    }).catch(() => {})
  }, [matchRef])

  async function save(playerId, value) {
    const n = Math.max(0, parseInt(value, 10) || 0)
    setGoals(g => ({ ...g, [playerId]: n }))
    setSaving(playerId)
    try {
      await setMatchGoal(matchRef, playerId, n)
    } finally {
      setSaving('')
    }
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
        {players.map(p => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 13, padding: '4px 8px', border: '1px solid #eee', borderRadius: 8 }}>
            <span>{p.nickname || p.name}</span>
            <input type="number" min="0" value={goals[p.id] ?? 0}
              onChange={e => save(p.id, e.target.value)}
              style={{ width: 48, fontSize: 13, padding: '2px 4px', borderRadius: 6, border: '1px solid #ddd', textAlign: 'center' }} />
          </div>
        ))}
      </div>
      {players.length === 0 && <p style={{ color: '#666', fontSize: 13 }}>Nog geen spelers toegevoegd.</p>}
      {saving && <p style={{ fontSize: 11, color: '#999', margin: '6px 0 0' }}>Opslaan...</p>}
    </div>
  )
}

export default function MatchAdminDetail({ matchRef, onBack }) {
  const [item, setItem] = useState(null)
  const [entries, setEntries] = useState([])
  const [players, setPlayers] = useState([])
  const [reports, setReports] = useState([])
  const [photos, setPhotos] = useState([])
  const [links, setLinks] = useState([])
  const [error, setError] = useState('')

  function loadReports() {
    getReportsModeration().then(rows => setReports(rows.filter(r => r.match_ref === matchRef))).catch(e => setError(e.message))
  }
  function loadPhotos() {
    getPhotosModeration().then(rows => setPhotos(rows.filter(p => p.match_ref === matchRef))).catch(e => setError(e.message))
  }
  function loadLinks() {
    listContributorLinks().then(rows => setLinks(rows.filter(l => l.match_ref === matchRef))).catch(e => setError(e.message))
  }

  useEffect(() => {
    getTimelineItem(matchRef).then(setItem).catch(e => setError(e.message))
    getTimeline().then(setEntries).catch(() => {})
    getPlayers().then(setPlayers).catch(() => {})
    loadReports()
    loadPhotos()
    loadLinks()
  }, [matchRef])

  function entryTitle(ref) {
    return entries.find(e => e.match_ref === ref)?.title || ref
  }

  async function togglePublishReport(r) {
    await updateReport(r.id, { status: r.status === 'published' ? 'concept' : 'published' })
    loadReports()
  }
  async function deleteReportRow(id) {
    await deleteReport(id)
    loadReports()
  }
  async function toggleReportTag(r, playerId) {
    if (r.player_ids.includes(playerId)) await untagReport(r.id, playerId)
    else await tagReport(r.id, playerId)
    loadReports()
  }
  async function saveReportEdit(id, body) {
    await updateReport(id, body)
    loadReports()
  }

  async function togglePublishPhoto(p) {
    await updatePhoto(p.id, { status: p.status === 'published' ? 'concept' : 'published' })
    loadPhotos()
  }
  async function deletePhotoRow(id) {
    await deletePhoto(id)
    loadPhotos()
  }
  async function togglePhotoTag(p, playerId) {
    if (p.player_ids.includes(playerId)) await untagPhoto(p.id, playerId)
    else await tagPhoto(p.id, playerId)
    loadPhotos()
  }
  async function savePhotoCaption(p, value) {
    await updatePhoto(p.id, { caption: value })
    loadPhotos()
  }

  return (
    <div>
      <button onClick={onBack} style={{ fontSize: 13, cursor: 'pointer', marginBottom: 10 }}>&larr; terug naar de lijst</button>
      {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}
      {item && <h3 style={{ fontSize: 16, margin: '0 0 4px' }}>{item.title}</h3>}
      {item && <p style={{ fontSize: 12, color: '#666', margin: '0 0 16px' }}>{item.date?.slice(0, 10)} &middot; {item.kind}</p>}

      <h4 style={{ fontSize: 14, margin: '0 0 8px' }}>Voorbeeld van de publieke pagina</h4>
      <div style={{ border: '3px dashed #f4c81e', borderRadius: 12, padding: 12, marginBottom: 20 }}>
        <PublicEntry matchRef={matchRef} onBack={() => {}} previewMode />
      </div>

      <h4 style={{ fontSize: 14, margin: '0 0 8px' }}>Doelpunten</h4>
      <div style={{ marginBottom: 20 }}>
        <GoalsPanel matchRef={matchRef} players={players} />
      </div>

      <h4 style={{ fontSize: 14, margin: '0 0 8px' }}>Foto&rsquo;s</h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginBottom: 20 }}>
        {photos.map(p => (
          <PhotoCard key={p.id} photo={p} players={players} entryTitle={entryTitle}
            onTogglePublish={togglePublishPhoto} onDelete={deletePhotoRow} onToggleTag={togglePhotoTag} onSaveCaption={savePhotoCaption} />
        ))}
        {photos.length === 0 && <p style={{ color: '#666', fontSize: 13 }}>Nog geen foto&rsquo;s voor deze wedstrijd.</p>}
      </div>

      <h4 style={{ fontSize: 14, margin: '0 0 8px' }}>Verslagen &amp; interviews</h4>
      {reports.map(r => (
        <ReportCard key={r.id} report={r} entries={entries} players={players} entryTitle={entryTitle}
          onTogglePublish={togglePublishReport} onDelete={deleteReportRow} onToggleTag={toggleReportTag} onSave={saveReportEdit}
          onLinksChanged={loadReports} />
      ))}
      {reports.length === 0 && <p style={{ color: '#666', fontSize: 13, marginBottom: 16 }}>Nog geen verslagen voor deze wedstrijd.</p>}

      <h4 style={{ fontSize: 14, margin: '16px 0 8px' }}>Wedstrijdbeelden toevoegen (Instagram/YouTube)</h4>
      <div style={{ marginBottom: 20 }}>
        <NewMatchFootage matchRef={matchRef} existingReport={reports.find(r => r.report_type === 'wedstrijd_beelden')} onCreated={loadReports} />
      </div>

      <h4 style={{ fontSize: 14, margin: '16px 0 8px' }}>Nieuw bericht / invullinkjes voor deze wedstrijd</h4>
      <NewMessageLinks matchRef={matchRef} players={players} links={links} onCreated={loadLinks} />
    </div>
  )
}
