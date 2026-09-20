import { useState, useEffect } from 'react'
import { getMatchGoals, setMatchGoal } from '../../api.js'

export function GoalsPanel({ matchRef, players }) {
  const [goals, setGoals] = useState({})
  const [saving, setSaving] = useState('')
  // Alleen speelsters (rugnummer) kunnen doelpunten maken - begeleiding
  // (role_title, geen rugnummer) hoort hier niet tussen te staan.
  const scoringPlayers = players.filter(p => p.shirt_number != null)

  useEffect(() => {
    getMatchGoals(matchRef).then(rows => {
      const map = {}
      rows.forEach(r => { map[r.player_id] = r.goals })
      setGoals(map)
    }).catch(() => {})
  }, [matchRef])

  async function save(playerId, value) {
    const n = Math.max(0, parseInt(value, 10) || 0)
    setGoals(g => ({ ...g, [playerId]: n }))
    setSaving(playerId)
    try {
      await setMatchGoal(matchRef, playerId, n)
    } finally {
      setSaving('')
    }
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
        {scoringPlayers.map(p => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 13, padding: '4px 8px', border: '1px solid #eee', borderRadius: 8 }}>
            <span>{p.nickname || p.name}</span>
            <input type="number" min="0" value={goals[p.id] ?? 0}
              onChange={e => save(p.id, e.target.value)}
              style={{ width: 48, fontSize: 13, padding: '2px 4px', borderRadius: 6, border: '1px solid #ddd', textAlign: 'center' }} />
          </div>
        ))}
      </div>
      {scoringPlayers.length === 0 && <p style={{ color: '#666', fontSize: 13 }}>Nog geen spelers toegevoegd.</p>}
      {saving && <p style={{ fontSize: 11, color: '#999', margin: '6px 0 0' }}>Opslaan...</p>}
    </div>
  )
}
