import { useState } from 'react'
import { createContributorLink } from '../../api.js'
import LinkPanel from '../LinkPanel.jsx'

// Nieuw invullinkje maken; de bestaande invullinks van deze wedstrijd (met
// invul-status, bezoeken, kopieer) staan in het generieke LinkPanel eronder.
export function InviteLinkScreen({ matchRef, players, onBack }) {
  const [playerId, setPlayerId] = useState('')
  const [reportType, setReportType] = useState('wedstrijdverslag')
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  async function make() {
    try {
      await createContributorLink({ match_ref: matchRef, player_id: playerId || null, report_type: reportType, expires_days: 14 })
      setReloadKey(k => k + 1)
    } catch (e) {
      setError(e.message)
    }
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

      <LinkPanel kinds={['contribute']} filter={l => l.match_ref === matchRef} reloadKey={reloadKey} />
    </div>
  )
}
