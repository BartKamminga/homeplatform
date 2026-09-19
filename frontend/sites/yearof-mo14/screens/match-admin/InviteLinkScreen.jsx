import { useState, useEffect } from 'react'
import { createContributorLink, listContributorLinks } from '../../api.js'
import { copyToClipboard } from '../../clipboard.js'
import { contributorLinkStatus } from '../../linkStatus.js'

export function InviteLinkScreen({ matchRef, players, onBack }) {
  const [links, setLinks] = useState([])
  const [playerId, setPlayerId] = useState('')
  const [reportType, setReportType] = useState('wedstrijdverslag')
  const [error, setError] = useState('')
  const [copiedId, setCopiedId] = useState('')

  function load() {
    listContributorLinks().then(rows => setLinks(rows.filter(l => l.match_ref === matchRef))).catch(e => setError(e.message))
  }
  useEffect(load, [matchRef])

  function playerName(id) {
    return players.find(p => p.id === id)?.nickname || players.find(p => p.id === id)?.name || '-'
  }

  async function make() {
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

  return (
    <div style={{ marginBottom: 24 }}>
      <button onClick={onBack} style={{ fontSize: 12, cursor: 'pointer', marginBottom: 12 }}>&larr; terug</button>
      <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>Invullinkje versturen</h3>
      {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <select value={reportType} onChange={e => setReportType(e.target.value)} style={{ fontSize: 12 }}>
          <option value="wedstrijdverslag">Wedstrijdverslag</option>
          <option value="interview">Interview</option>
          <option value="foto">Foto&rsquo;s &amp; filmpjes (geen tekst)</option>
        </select>
        <select value={playerId} onChange={e => setPlayerId(e.target.value)} style={{ fontSize: 12 }}>
          <option value="">Voor het hele team / mezelf</option>
          {players.map(p => <option key={p.id} value={p.id}>{p.nickname || p.name}</option>)}
        </select>
        <button onClick={make} className="yof-btn-secondary">Nieuw invullinkje</button>
      </div>

      {links.map(l => {
        const status = contributorLinkStatus(l)
        const url = `${window.location.origin}/yearof-mo14/?invul=${l.id}`
        return (
          <div key={l.id} className="yof-card" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: '#999', marginBottom: 4 }}>{l.report_type}</div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{l.player_id ? playerName(l.player_id) : 'team'}</div>
              <div style={{ fontSize: 12, marginTop: 4, color: status.color, fontWeight: 600 }}>{status.label}</div>
              <input readOnly value={url} onFocus={e => e.target.select()}
                style={{ marginTop: 6, width: '100%', maxWidth: 320, boxSizing: 'border-box', fontSize: 11, padding: '4px 6px', borderRadius: 6, border: '1px solid #ddd' }} />
            </div>
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <button onClick={() => copy(l)} className="yof-btn-secondary">
                {copiedId === l.id ? 'Gekopieerd!' : 'Kopieer'}
              </button>
              <button onClick={() => openLink(l)} className="yof-btn-secondary">Openen</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
