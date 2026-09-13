import { useState, useEffect } from 'react'
import { getPlayers } from '../api.js'

export default function PublicTeam({ onOpenPlayer }) {
  const [players, setPlayers] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    getPlayers().then(setPlayers).catch(e => setError(e.message))
  }, [])

  return (
    <div>
      <h2 style={{ fontSize: 17, margin: '0 0 12px' }}>Het team</h2>
      {error && <p style={{ color: '#c23b3b' }}>{error}</p>}
      <div className="yof-grid">
        {players.map(p => (
          <a key={p.id} className="yof-card yof-player-card" href="#" onClick={e => { e.preventDefault(); onOpenPlayer(p.id) }}>
            <div className="avatar">{p.shirt_number ?? '?'}</div>
            <h3>{p.nickname || p.name}</h3>
            <div className="pos">{p.position || '-'}</div>
          </a>
        ))}
        {players.length === 0 && !error && <p style={{ color: '#666', fontSize: 13 }}>Nog geen spelers toegevoegd.</p>}
      </div>
    </div>
  )
}
