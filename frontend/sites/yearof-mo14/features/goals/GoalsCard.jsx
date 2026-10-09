import { useState, useEffect } from 'react'
import { getMatchGoals, getPlayers } from '../../api.js'

// Doelpuntenblok op een wedstrijdpagina: per scorer een kleine kaart met foto,
// naam en aantal. Zonder doelpunten ziet een bezoeker niets; in het
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
          {scorers.map(({ player, goals }) => (
            <div key={player.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 6, borderRadius: 10, background: '#f4f6fb' }}>
              {player.photo_url
                ? <img src={player.photo_url} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                : <span style={{ width: 40, height: 40, borderRadius: '50%', background: '#12203c', color: '#f4c81e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>
                    {player.shirt_number ?? (player.nickname || player.name || '?').slice(0, 1)}
                  </span>}
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {player.nickname || player.name}
              </span>
              <span style={{ fontSize: 15, fontWeight: 800, whiteSpace: 'nowrap' }}>⚽ {goals}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
