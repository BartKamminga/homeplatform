import { useState, useEffect } from 'react'
import { getPlayers } from '../api.js'
import PageTitle from '../features/pages/PageTitle.jsx'
import PlayerCard from '../features/players/PlayerCard.jsx'

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
          <PlayerCard key={p.id} player={p} onClick={() => onOpenPlayer(p.id)} />
        ))}
        {players.length === 0 && !error && <p style={{ color: '#666', fontSize: 13 }}>Nog geen spelers toegevoegd.</p>}
      </div>
    </div>
  )
}
