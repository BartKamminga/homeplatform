import { useState, useEffect } from 'react'
import { getPlayers } from '../api.js'
import PageTitle from '../features/pages/PageTitle.jsx'

export default function PublicTeam({ onOpenPlayer }) {
  const [players, setPlayers] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    getPlayers().then(setPlayers).catch(e => setError(e.message))
  }, [])

  return (
    <div>
      <PageTitle view="team" />
      {error && <p style={{ color: '#c23b3b' }}>{error}</p>}
      <div className="yof-grid">
        {players.map(p => (
          <a key={p.id} className="yof-card yof-player-card" href="#" onClick={e => { e.preventDefault(); onOpenPlayer(p.id) }}>
            <div className="photo-wrap">
              {p.photo_url
                ? <img src={p.photo_url} alt="" />
                : <div className="no-photo" style={p.role_title ? { fontSize: 14 } : undefined}>{p.role_title || p.shirt_number || '?'}</div>}
              {(p.role_title || p.shirt_number != null) && <span className="shirt-badge">{p.role_title || p.shirt_number}</span>}
            </div>
            <div className="info">
              <h3>{p.nickname || p.name}</h3>
              <div className="pos">{p.role_title || p.position || '-'}</div>
            </div>
          </a>
        ))}
        {players.length === 0 && !error && <p style={{ color: '#666', fontSize: 13 }}>Nog geen spelers toegevoegd.</p>}
      </div>
    </div>
  )
}
