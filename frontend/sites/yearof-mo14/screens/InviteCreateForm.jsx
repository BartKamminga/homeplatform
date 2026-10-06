import { useState, useEffect } from 'react'
import { createContributorLink, getTimelineModeration } from '../api.js'

// Nieuw invullinkje maken - in het Invullinks-blok van een wedstrijd (vaste
// matchRef, kies speelster) of van een speelster (vaste playerId, kies wedstrijd).
export default function InviteCreateForm({ matchRef = null, playerId = null, players = [], onCreated }) {
  const [reportType, setReportType] = useState('wedstrijdverslag')
  const [chosenPlayerId, setChosenPlayerId] = useState('')
  const [chosenMatchRef, setChosenMatchRef] = useState('')
  const [matches, setMatches] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (matchRef) return
    getTimelineModeration()
      .then(items => setMatches([...items].sort((a, b) => (b.date || '').localeCompare(a.date || ''))))
      .catch(e => setError(e.message))
  }, [matchRef])

  async function make() {
    const targetMatch = matchRef || chosenMatchRef
    if (!targetMatch) { setError('Kies eerst een wedstrijd'); return }
    try {
      setError('')
      await createContributorLink({
        match_ref: targetMatch,
        player_id: playerId || chosenPlayerId || null,
        report_type: reportType,
        expires_days: 14,
      })
      onCreated?.()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <select value={reportType} onChange={e => setReportType(e.target.value)} style={{ fontSize: 12 }}>
        <option value="wedstrijdverslag">Wedstrijdverslag</option>
        <option value="interview">Interview</option>
        <option value="foto">Foto&rsquo;s &amp; filmpjes (geen tekst)</option>
      </select>
      {!matchRef && (
        <select value={chosenMatchRef} onChange={e => setChosenMatchRef(e.target.value)} style={{ fontSize: 12, maxWidth: 260 }}>
          <option value="">Kies wedstrijd...</option>
          {matches.map(m => <option key={m.match_ref} value={m.match_ref}>{m.date?.slice(0, 10)} · {m.title}</option>)}
        </select>
      )}
      {!playerId && (
        <select value={chosenPlayerId} onChange={e => setChosenPlayerId(e.target.value)} style={{ fontSize: 12 }}>
          <option value="">Voor het hele team / mezelf</option>
          {players.map(p => <option key={p.id} value={p.id}>{p.nickname || p.name}</option>)}
        </select>
      )}
      <button onClick={make} className="yof-btn-secondary">Nieuw invullinkje</button>
      {error && <span style={{ color: '#c23b3b', fontSize: 12 }}>{error}</span>}
    </div>
  )
}
