import { useState, useEffect } from 'react'
import {
  getTimeline, getPlayers,
  createContributorLink, listContributorLinks,
  getReportsModeration, createReportDirect, updateReport, deleteReport, tagReport, untagReport,
} from '../api.js'

function ContributorLinks({ entries, players }) {
  const [links, setLinks] = useState([])
  const [error, setError] = useState('')
  const [matchRef, setMatchRef] = useState('')
  const [playerId, setPlayerId] = useState('')
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
      await createContributorLink({ match_ref: matchRef, player_id: playerId || null, expires_days: 14 })
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  async function copy(link) {
    const url = `${window.location.origin}/yearof-mo14/?invul=${link.id}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(link.id)
      setTimeout(() => setCopiedId(''), 2000)
    } catch { /* clipboard kan geblokkeerd zijn - link staat sowieso in de tabel */ }
  }

  function entryTitle(matchRef) {
    return entries.find(e => e.match_ref === matchRef)?.title || matchRef
  }
  function playerName(id) {
    return players.find(p => p.id === id)?.nickname || players.find(p => p.id === id)?.name || '-'
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>Wedstrijd-invullinkjes</h3>
      {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <select value={matchRef} onChange={e => setMatchRef(e.target.value)} style={{ fontSize: 12 }}>
          {entries.map(it => <option key={it.match_ref} value={it.match_ref}>{it.title}</option>)}
        </select>
        <select value={playerId} onChange={e => setPlayerId(e.target.value)} style={{ fontSize: 12 }}>
          <option value="">Voor het hele team</option>
          {players.map(p => <option key={p.id} value={p.id}>{p.nickname || p.name}</option>)}
        </select>
        <button onClick={make} style={{ fontSize: 12, cursor: 'pointer' }}>Nieuw invullinkje</button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: '#888' }}>
            <th style={{ padding: 6 }}>Voor</th>
            <th style={{ padding: 6 }}>Speler</th>
            <th style={{ padding: 6 }}>Vervalt</th>
            <th style={{ padding: 6 }}></th>
          </tr>
        </thead>
        <tbody>
          {links.map(l => (
            <tr key={l.id} style={{ borderTop: '1px solid #eee' }}>
              <td style={{ padding: 6 }}>{entryTitle(l.match_ref)}</td>
              <td style={{ padding: 6 }}>{l.player_id ? playerName(l.player_id) : 'team'}</td>
              <td style={{ padding: 6 }}>{l.expires_at?.slice(0, 10)}</td>
              <td style={{ padding: 6 }}>
                <button onClick={() => copy(l)} style={{ fontSize: 11, cursor: 'pointer' }}>
                  {copiedId === l.id ? 'Gekopieerd!' : 'Kopieer link'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DirectReportForm({ entries, onCreated }) {
  const [matchRef, setMatchRef] = useState('')
  const [reportType, setReportType] = useState('wedstrijdverslag')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { if (entries.length && !matchRef) setMatchRef(entries[0].match_ref) }, [entries])

  async function submit() {
    if (!matchRef || !title.trim() || !body.trim()) return
    try {
      await createReportDirect({ match_ref: matchRef, report_type: reportType, title, body, status: 'published' })
      setTitle(''); setBody('')
      onCreated()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>Verslag schrijven</h3>
      {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <select value={matchRef} onChange={e => setMatchRef(e.target.value)} style={{ fontSize: 12 }}>
          {entries.map(it => <option key={it.match_ref} value={it.match_ref}>{it.title}</option>)}
        </select>
        <select value={reportType} onChange={e => setReportType(e.target.value)} style={{ fontSize: 12 }}>
          <option value="wedstrijdverslag">Wedstrijdverslag</option>
          <option value="interview">Interview</option>
          <option value="nieuws">Nieuws</option>
        </select>
      </div>
      <input placeholder="Titel" value={title} onChange={e => setTitle(e.target.value)}
        style={{ width: '100%', boxSizing: 'border-box', padding: 8, fontSize: 13, marginBottom: 8 }} />
      <textarea placeholder="Tekst" value={body} onChange={e => setBody(e.target.value)} rows={4}
        style={{ width: '100%', boxSizing: 'border-box', padding: 8, fontSize: 13, marginBottom: 8 }} />
      <button onClick={submit} style={{ fontSize: 13, cursor: 'pointer' }}>Publiceren</button>
    </div>
  )
}

export default function ReportsAdmin() {
  const [entries, setEntries] = useState([])
  const [players, setPlayers] = useState([])
  const [reports, setReports] = useState([])
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

  return (
    <div>
      <ContributorLinks entries={entries} players={players} />
      <DirectReportForm entries={entries} onCreated={loadReports} />

      <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>Verslagen &amp; interviews</h3>
      {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}

      {reports.map(r => (
        <div key={r.id} style={{ border: '1px solid #eee', borderRadius: 8, padding: 12, marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
            <div>
              <span style={{ color: r.status === 'published' ? '#16a34a' : '#d97706', fontWeight: 700, fontSize: 11 }}>
                {r.status === 'published' ? 'Gepubliceerd' : 'Concept'}
              </span>
              {' · '}
              <span style={{ fontSize: 11, color: '#888' }}>{r.report_type} · {entryTitle(r.match_ref)}</span>
            </div>
          </div>
          <h4 style={{ margin: '6px 0 4px', fontSize: 14 }}>{r.title}</h4>
          {r.author_name && <p style={{ margin: '0 0 4px', fontSize: 12, color: '#666' }}>door {r.author_name}</p>}
          <p style={{ margin: '0 0 8px', fontSize: 13, whiteSpace: 'pre-wrap' }}>{r.body}</p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {players.map(pl => {
              const tagged = r.player_ids.includes(pl.id)
              return (
                <button key={pl.id} onClick={() => toggleTag(r, pl.id)}
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
            <button onClick={() => togglePublish(r)} style={{ fontSize: 12, cursor: 'pointer' }}>
              {r.status === 'published' ? 'Terug naar concept' : 'Publiceren'}
            </button>
            <button onClick={() => remove(r.id)} style={{ fontSize: 12, cursor: 'pointer' }}>Verwijderen</button>
          </div>
        </div>
      ))}
      {reports.length === 0 && !error && <p style={{ color: '#666', fontSize: 13 }}>Nog geen verslagen.</p>}
    </div>
  )
}
