import { useState, useEffect } from 'react'
import {
  getTimeline, getPlayers,
  createContributorLink, listContributorLinks,
  getReportsModeration, createReportDirect, updateReport, deleteReport, tagReport, untagReport,
} from '../api.js'
import { copyToClipboard } from '../clipboard.js'
import { contributorLinkStatus } from '../linkStatus.js'
import { ExistingLinksEditor, LinkTiles } from './ReportLinks.jsx'

function ContributorLinks({ entries, players }) {
  const [links, setLinks] = useState([])
  const [error, setError] = useState('')
  const [matchRef, setMatchRef] = useState('')
  const [playerId, setPlayerId] = useState('')
  const [reportType, setReportType] = useState('interview')
  const [copiedId, setCopiedId] = useState('')

  function load() {
    listContributorLinks().then(setLinks).catch(e => setError(e.message))
  }
  useEffect(() => {
    load()
    if (entries.length && !matchRef) setMatchRef(entries[0].match_ref)
  }, [entries])

  async function make() {
    if (!matchRef) return
    try {
      await createContributorLink({ match_ref: matchRef, player_id: playerId || null, report_type: reportType, expires_days: 14 })
      load()
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

  function openLink(link) {
    window.open(`${window.location.origin}/yearof-mo14/?invul=${link.id}`, '_blank')
  }

  function entryTitle(matchRef) {
    return entries.find(e => e.match_ref === matchRef)?.title || matchRef
  }
  function playerName(id) {
    return players.find(p => p.id === id)?.nickname || players.find(p => p.id === id)?.name || '-'
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>Wedstrijd verslagen-invullinkjes</h3>
      {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <select value={matchRef} onChange={e => setMatchRef(e.target.value)} style={{ fontSize: 12 }}>
          {entries.map(it => <option key={it.match_ref} value={it.match_ref}>{it.title}</option>)}
        </select>
        <select value={playerId} onChange={e => setPlayerId(e.target.value)} style={{ fontSize: 12 }}>
          <option value="">Voor het hele team</option>
          {players.map(p => <option key={p.id} value={p.id}>{p.nickname || p.name}</option>)}
        </select>
        <select value={reportType} onChange={e => setReportType(e.target.value)} style={{ fontSize: 12 }}>
          <option value="interview">Interview</option>
          <option value="wedstrijdverslag">Wedstrijdverslag (bv. vooraf-preview)</option>
        </select>
        <button onClick={make} style={{ fontSize: 12, cursor: 'pointer' }}>Nieuw invullinkje</button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: '#888' }}>
            <th style={{ padding: 6 }}>Voor</th>
            <th style={{ padding: 6 }}>Speler</th>
            <th style={{ padding: 6 }}>Type</th>
            <th style={{ padding: 6 }}>Status</th>
            <th style={{ padding: 6 }}>Vervalt</th>
            <th style={{ padding: 6 }}>Link</th>
            <th style={{ padding: 6 }}></th>
          </tr>
        </thead>
        <tbody>
          {links.map(l => {
            const url = `${window.location.origin}/yearof-mo14/?invul=${l.id}`
            const expired = new Date(l.expires_at) < new Date()
            const status = contributorLinkStatus(l)
            return (
              <tr key={l.id} style={{ borderTop: '1px solid #eee' }}>
                <td style={{ padding: 6 }}>{entryTitle(l.match_ref)}</td>
                <td style={{ padding: 6 }}>{l.player_id ? playerName(l.player_id) : 'team'}</td>
                <td style={{ padding: 6 }}>{l.report_type}</td>
                <td style={{ padding: 6, color: status.color, fontWeight: 600 }}>{status.label}</td>
                <td style={{ padding: 6, color: (l.revoked_at || expired) ? '#c23b3b' : 'inherit' }}>
                  {l.expires_at?.slice(0, 10)}{expired ? ' (verlopen)' : ''}
                </td>
                <td style={{ padding: 6, width: 220 }}>
                  <input readOnly value={url} onFocus={e => e.target.select()}
                    style={{ width: '100%', boxSizing: 'border-box', fontSize: 11, padding: '4px 6px', borderRadius: 6, border: '1px solid #ddd' }} />
                </td>
                <td style={{ padding: 6, display: 'flex', gap: 4 }}>
                  <button onClick={() => copy(l)} style={{ fontSize: 11, cursor: 'pointer' }}>
                    {copiedId === l.id ? 'Gekopieerd!' : 'Kopieer'}
                  </button>
                  <button onClick={() => openLink(l)} style={{ fontSize: 11, cursor: 'pointer' }}>Bewerken</button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

const labelStyle = { display: 'block', fontSize: 13, fontWeight: 700, margin: '0 0 6px' }
const wideFieldStyle = { width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 10, border: '1px solid #ddd', marginBottom: 14, fontSize: 15 }

// Los invulformulier voor een DOOR DE BEHEERDER direct geschreven verslag/
// interview - bewust gescheiden van de linkjes-invoer (Instagram/wedstrijd-
// beelden gaat via de wedstrijd-adminpagina, niet hier). Zelfde stijl en
// voorbeeld-modus als de publieke invulpagina (ContributeReport.jsx) en het
// spelersprofiel (EditProfile.jsx), zodat je precies ziet hoe het wordt.
function NewReportForm({ entries, onCreated, onCancel }) {
  const [matchRef, setMatchRef] = useState('')
  const [reportType, setReportType] = useState('wedstrijdverslag')
  const [role, setRole] = useState('speelster')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!title.trim() || !body.trim()) return
    setSending(true)
    try {
      await createReportDirect({
        match_ref: matchRef || null,
        report_type: reportType,
        interviewee_role: reportType === 'interview' ? role : null,
        title, body,
        author_name: authorName || null,
        status: 'published',
      })
      onCreated()
    } catch (e) {
      setError(e.message)
    } finally {
      setSending(false)
    }
  }

  if (showPreview) {
    return (
      <div style={{ marginBottom: 24 }}>
        <a className="yof-back" href="#" onClick={e => { e.preventDefault(); setShowPreview(false) }}>&larr; terug naar bewerken</a>
        <div className="yof-card" style={{ marginBottom: 10 }}>
          <h4 style={{ margin: '0 0 4px', fontSize: 15 }}>{title || '(geen titel)'}</h4>
          {authorName && <p style={{ margin: '0 0 4px', fontSize: 12, color: '#666' }}>door {authorName}</p>}
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{body || '(geen tekst)'}</p>
        </div>
        <p style={{ fontSize: 12, color: '#999', margin: '0 0 10px' }}>
          Zo ziet dit bericht eruit op de site. Nog niet gepubliceerd.
        </p>
        <button className="yof-btn" onClick={() => setShowPreview(false)}>&larr; Terug om verder te bewerken</button>
      </div>
    )
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <h3 style={{ fontSize: 15, margin: 0 }}>Nieuw verslag / interview</h3>
        <button onClick={onCancel} style={{ fontSize: 12, cursor: 'pointer' }}>annuleren</button>
      </div>
      {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <select value={matchRef} onChange={e => setMatchRef(e.target.value)} style={{ fontSize: 13 }}>
          <option value="">Geen specifieke wedstrijd (algemeen)</option>
          {entries.map(it => <option key={it.match_ref} value={it.match_ref}>{it.title}</option>)}
        </select>
        <select value={reportType} onChange={e => setReportType(e.target.value)} style={{ fontSize: 13 }}>
          <option value="wedstrijdverslag">Wedstrijdverslag</option>
          <option value="interview">Interview</option>
          <option value="nieuws">Algemeen (niet wedstrijd gebonden)</option>
        </select>
        {reportType === 'interview' && (
          <select value={role} onChange={e => setRole(e.target.value)} style={{ fontSize: 13 }}>
            <option value="speelster">Speelster</option>
            <option value="coach">Coach</option>
            <option value="ouder">Ouder</option>
          </select>
        )}
      </div>

      <label style={labelStyle}>Titel</label>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Bijv. Een spannende wedstrijd" style={wideFieldStyle} />

      <label style={labelStyle}>Tekst</label>
      <textarea value={body} onChange={e => setBody(e.target.value)} rows={6} style={wideFieldStyle} />

      <label style={labelStyle}>Door (naam, optioneel)</label>
      <input value={authorName} onChange={e => setAuthorName(e.target.value)} style={wideFieldStyle} />

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="yof-btn" onClick={() => setShowPreview(true)}
          style={{ flex: 1, background: 'transparent', border: '1px solid #ddd', color: 'inherit' }}>
          Voorbeeld bekijken
        </button>
        <button className="yof-btn" onClick={submit} disabled={sending} style={{ flex: 1 }}>
          {sending ? 'Publiceren...' : 'Publiceren'}
        </button>
      </div>
    </div>
  )
}

export function ReportCard({ report, entries, players, entryTitle, onTogglePublish, onDelete, onToggleTag, onSave, onLinksChanged }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(null)

  function startEdit() {
    setForm({
      match_ref: report.match_ref || '',
      report_type: report.report_type,
      interviewee_role: report.interviewee_role || 'speelster',
      title: report.title,
      body: report.body,
      author_name: report.author_name || '',
    })
    setEditing(true)
  }

  async function save() {
    await onSave(report.id, {
      match_ref: form.match_ref || null,
      report_type: form.report_type,
      interviewee_role: form.report_type === 'interview' ? form.interviewee_role : null,
      title: form.title,
      body: form.body,
      author_name: form.author_name || null,
    })
    setEditing(false)
  }

  if (editing) {
    return (
      <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 10, background: '#fafafa' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <select value={form.match_ref} onChange={e => setForm({ ...form, match_ref: e.target.value })} style={{ fontSize: 12 }}>
            <option value="">Geen specifieke wedstrijd (algemeen)</option>
            {entries.map(it => <option key={it.match_ref} value={it.match_ref}>{it.title}</option>)}
          </select>
          <select value={form.report_type} onChange={e => setForm({ ...form, report_type: e.target.value })} style={{ fontSize: 12 }}>
            <option value="wedstrijdverslag">Wedstrijdverslag</option>
            <option value="interview">Interview</option>
            <option value="wedstrijd_beelden">Wedstrijdbeelden</option>
            <option value="nieuws">Algemeen (niet wedstrijd gebonden)</option>
          </select>
          {form.report_type === 'interview' && (
            <select value={form.interviewee_role} onChange={e => setForm({ ...form, interviewee_role: e.target.value })} style={{ fontSize: 12 }}>
              <option value="speelster">Speelster</option>
              <option value="coach">Coach</option>
              <option value="ouder">Ouder</option>
            </select>
          )}
        </div>
        <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Titel"
          style={{ width: '100%', boxSizing: 'border-box', padding: 8, fontSize: 13, marginBottom: 8 }} />
        <textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} rows={4} placeholder="Tekst"
          style={{ width: '100%', boxSizing: 'border-box', padding: 8, fontSize: 13, marginBottom: 8 }} />
        <input value={form.author_name} onChange={e => setForm({ ...form, author_name: e.target.value })} placeholder="Door (naam, optioneel)"
          style={{ width: '100%', boxSizing: 'border-box', padding: 8, fontSize: 13, marginBottom: 8 }} />

        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, margin: '4px 0 6px' }}>Linkjes (Instagram/Wedstrijdbeelden)</label>
        <ExistingLinksEditor reportId={report.id} links={report.links || []} onChanged={onLinksChanged} />

        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={save} style={{ fontSize: 12, cursor: 'pointer' }}>Opslaan</button>
          <button onClick={() => setEditing(false)} style={{ fontSize: 12, cursor: 'pointer' }}>Annuleren</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ border: '1px solid #eee', borderRadius: 8, padding: 12, marginBottom: 10 }}>
      <div>
        <span style={{ color: report.status === 'published' ? '#16a34a' : '#d97706', fontWeight: 700, fontSize: 11 }}>
          {report.status === 'published' ? 'Gepubliceerd' : 'Concept'}
        </span>
        {' · '}
        <span style={{ fontSize: 11, color: '#888' }}>{report.report_type} · {entryTitle(report.match_ref)}</span>
      </div>
      <h4 style={{ margin: '6px 0 4px', fontSize: 14 }}>{report.title}</h4>
      {report.author_name && <p style={{ margin: '0 0 4px', fontSize: 12, color: '#666' }}>door {report.author_name}</p>}
      {report.body && <p style={{ margin: '0 0 8px', fontSize: 13, whiteSpace: 'pre-wrap' }}>{report.body}</p>}
      <LinkTiles links={report.links} />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
        {players.map(pl => {
          const tagged = report.player_ids.includes(pl.id)
          return (
            <button key={pl.id} onClick={() => onToggleTag(report, pl.id)}
              style={{
                border: 'none', borderRadius: 999, padding: '3px 8px', fontSize: 11, cursor: 'pointer',
                background: tagged ? '#16a34a' : '#e5e7eb', color: tagged ? 'white' : '#555',
              }}>
              {pl.nickname || pl.name}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={startEdit} style={{ fontSize: 12, cursor: 'pointer' }}>Bewerken</button>
        <button onClick={() => onTogglePublish(report)} style={{ fontSize: 12, cursor: 'pointer' }}>
          {report.status === 'published' ? 'Terug naar concept' : 'Publiceren'}
        </button>
        <button onClick={() => onDelete(report.id)} style={{ fontSize: 12, cursor: 'pointer' }}>Verwijderen</button>
      </div>
    </div>
  )
}

export default function ReportsAdmin() {
  const [entries, setEntries] = useState([])
  const [players, setPlayers] = useState([])
  const [reports, setReports] = useState([])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  function loadReports() {
    getReportsModeration().then(setReports).catch(e => setError(e.message))
  }
  useEffect(() => {
    loadReports()
    getTimeline().then(setEntries).catch(() => {})
    getPlayers().then(setPlayers).catch(() => {})
  }, [])

  function entryTitle(matchRef) {
    if (!matchRef) return 'Algemeen'
    return entries.find(e => e.match_ref === matchRef)?.title || matchRef
  }

  async function togglePublish(r) {
    try {
      await updateReport(r.id, { status: r.status === 'published' ? 'concept' : 'published' })
      loadReports()
    } catch (e) {
      setError(e.message)
    }
  }

  async function remove(id) {
    try {
      await deleteReport(id)
      loadReports()
    } catch (e) {
      setError(e.message)
    }
  }

  async function toggleTag(r, playerId) {
    try {
      if (r.player_ids.includes(playerId)) await untagReport(r.id, playerId)
      else await tagReport(r.id, playerId)
      loadReports()
    } catch (e) {
      setError(e.message)
    }
  }

  async function saveEdit(id, body) {
    try {
      await updateReport(id, body)
      loadReports()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div>
      <ContributorLinks entries={entries} players={players} />

      {creating ? (
        <NewReportForm entries={entries} onCreated={() => { setCreating(false); loadReports() }} onCancel={() => setCreating(false)} />
      ) : (
        <button onClick={() => setCreating(true)} style={{ fontSize: 13, cursor: 'pointer', marginBottom: 20 }}>
          + Nieuw verslag / interview schrijven
        </button>
      )}

      <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>Verslagen &amp; interviews</h3>
      {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}

      {reports.map(r => (
        <ReportCard
          key={r.id}
          report={r}
          entries={entries}
          players={players}
          entryTitle={entryTitle}
          onTogglePublish={togglePublish}
          onDelete={remove}
          onToggleTag={toggleTag}
          onLinksChanged={loadReports}
          onSave={saveEdit}
        />
      ))}
      {reports.length === 0 && !error && <p style={{ color: '#666', fontSize: 13 }}>Nog geen verslagen.</p>}
    </div>
  )
}
