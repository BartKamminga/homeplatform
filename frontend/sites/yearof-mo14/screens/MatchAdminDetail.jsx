import { useState, useEffect } from 'react'
import {
  getTimeline, getTimelineItem, getPlayers,
  getReportsModeration, createReportDirect, updateReport, deleteReport, tagReport, untagReport,
  getPhotosModeration, updatePhoto, deletePhoto, tagPhoto, untagPhoto,
  createContributorLink,
} from '../api.js'
import { copyToClipboard } from '../clipboard.js'
import { ReportCard } from './ReportsAdmin.jsx'
import { PhotoCard } from './PhotosAdmin.jsx'
import PublicEntry from './PublicEntry.jsx'

function QuickReportForm({ matchRef, onCreated }) {
  const [reportType, setReportType] = useState('wedstrijdverslag')
  const [role, setRole] = useState('speelster')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState('')

  async function submit() {
    if (!title.trim() || !body.trim()) return
    try {
      await createReportDirect({
        match_ref: matchRef,
        report_type: reportType,
        interviewee_role: reportType === 'interview' ? role : null,
        title, body, status: 'published',
      })
      setTitle(''); setBody('')
      onCreated()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div>
      {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <select value={reportType} onChange={e => setReportType(e.target.value)} style={{ fontSize: 12 }}>
          <option value="wedstrijdverslag">Wedstrijdverslag</option>
          <option value="interview">Interview</option>
          <option value="nieuws">Nieuws</option>
        </select>
        {reportType === 'interview' && (
          <select value={role} onChange={e => setRole(e.target.value)} style={{ fontSize: 12 }}>
            <option value="speelster">Speelster</option>
            <option value="coach">Coach</option>
            <option value="ouder">Ouder</option>
          </select>
        )}
      </div>
      <input placeholder="Titel" value={title} onChange={e => setTitle(e.target.value)}
        style={{ width: '100%', boxSizing: 'border-box', padding: 8, fontSize: 13, marginBottom: 8 }} />
      <textarea placeholder="Tekst" value={body} onChange={e => setBody(e.target.value)} rows={3}
        style={{ width: '100%', boxSizing: 'border-box', padding: 8, fontSize: 13, marginBottom: 8 }} />
      <button onClick={submit} style={{ fontSize: 12, cursor: 'pointer' }}>Publiceren</button>
    </div>
  )
}

function QuickContributorLink({ matchRef, players }) {
  const [playerId, setPlayerId] = useState('')
  const [reportType, setReportType] = useState('interview')
  const [link, setLink] = useState(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  async function make() {
    try {
      const l = await createContributorLink({ match_ref: matchRef, player_id: playerId || null, report_type: reportType, expires_days: 14 })
      setLink(l)
    } catch (e) {
      setError(e.message)
    }
  }

  async function copy() {
    const url = `${window.location.origin}/yearof-mo14/?invul=${link.id}`
    try {
      await copyToClipboard(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div>
      {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <select value={playerId} onChange={e => setPlayerId(e.target.value)} style={{ fontSize: 12 }}>
          <option value="">Voor het hele team</option>
          {players.map(p => <option key={p.id} value={p.id}>{p.nickname || p.name}</option>)}
        </select>
        <select value={reportType} onChange={e => setReportType(e.target.value)} style={{ fontSize: 12 }}>
          <option value="interview">Interview</option>
          <option value="wedstrijdverslag">Wedstrijdverslag</option>
        </select>
        <button onClick={make} style={{ fontSize: 12, cursor: 'pointer' }}>Nieuw invullinkje</button>
      </div>
      {link && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input readOnly value={`${window.location.origin}/yearof-mo14/?invul=${link.id}`} onFocus={e => e.target.select()}
            style={{ flex: '1 1 220px', fontSize: 11, padding: '4px 6px', borderRadius: 6, border: '1px solid #ddd' }} />
          <button onClick={copy} style={{ fontSize: 11, cursor: 'pointer' }}>{copied ? 'Gekopieerd!' : 'Kopieer'}</button>
        </div>
      )}
    </div>
  )
}

export default function MatchAdminDetail({ matchRef, onBack }) {
  const [item, setItem] = useState(null)
  const [entries, setEntries] = useState([])
  const [players, setPlayers] = useState([])
  const [reports, setReports] = useState([])
  const [photos, setPhotos] = useState([])
  const [error, setError] = useState('')

  function loadReports() {
    getReportsModeration().then(rows => setReports(rows.filter(r => r.match_ref === matchRef))).catch(e => setError(e.message))
  }
  function loadPhotos() {
    getPhotosModeration().then(rows => setPhotos(rows.filter(p => p.match_ref === matchRef))).catch(e => setError(e.message))
  }

  useEffect(() => {
    getTimelineItem(matchRef).then(setItem).catch(e => setError(e.message))
    getTimeline().then(setEntries).catch(() => {})
    getPlayers().then(setPlayers).catch(() => {})
    loadReports()
    loadPhotos()
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
          onTogglePublish={togglePublishReport} onDelete={deleteReportRow} onToggleTag={toggleReportTag} onSave={saveReportEdit} />
      ))}
      {reports.length === 0 && <p style={{ color: '#666', fontSize: 13, marginBottom: 16 }}>Nog geen verslagen voor deze wedstrijd.</p>}

      <h4 style={{ fontSize: 14, margin: '16px 0 8px' }}>Nieuw verslag/interview voor deze wedstrijd</h4>
      <div style={{ marginBottom: 20 }}>
        <QuickReportForm matchRef={matchRef} onCreated={loadReports} />
      </div>

      <h4 style={{ fontSize: 14, margin: '0 0 8px' }}>Invullinkje voor deze wedstrijd</h4>
      <QuickContributorLink matchRef={matchRef} players={players} />
    </div>
  )
}
