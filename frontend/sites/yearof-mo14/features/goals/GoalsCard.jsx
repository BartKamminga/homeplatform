import { useState, useEffect } from 'react'
import { getMatchGoals, getPlayers } from '../../api.js'
import PlayerCard from '../players/PlayerCard.jsx'

// Doelpuntenblok op een wedstrijdpagina: per scorer de spelerskaart (zoals op
// de teampagina) met onder de naam het aantal doelpunten. Zonder doelpunten ziet een bezoeker niets; in het
// bewerkscherm staat dan een hint. De doelpunten zelf vul je in via Bewerken
// op het blok (GoalsPanel).
export default function GoalsCard({ matchRef, title, adminMode = false, dimmed = false, onClick }) {
  const [scorers, setScorers] = useState(null)

  useEffect(() => {
    Promise.all([getMatchGoals(matchRef), getPlayers()])
      .then(([goals, players]) => setScorers(goals
        .map(g => ({ ...g, player: players.find(p => p.id === g.player_id) }))
        .filter(g => g.player)
        .sort((a, b) => b.goals - a.goals || (a.player.shirt_number ?? 999) - (b.player.shirt_number ?? 999))))
      .catch(() => setScorers([]))
  }, [matchRef])

  if (!scorers || (scorers.length === 0 && !adminMode)) return null

  return (
    <div className="yof-card" onClick={onClick}
      style={{ marginBottom: 10, cursor: onClick ? 'pointer' : 'default', opacity: dimmed ? 0.5 : 1 }}>
      <h4 style={{ margin: '0 0 8px', fontSize: 15 }}>{title}</h4>
      {scorers.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: '#666' }}>Nog geen doelpunten ingevuld - gebruik Bewerken op dit blok.</p>
      ) : (
        <div className="yof-grid">
          {scorers.map(({ player, goals }) => (
            <PlayerCard key={player.id} player={player}
              subtitle={<strong style={{ color: '#141414' }}>⚽ {goals} {goals === 1 ? 'doelpunt' : 'doelpunten'}</strong>} />
          ))}
        </div>
      )}
    </div>
  )
}
