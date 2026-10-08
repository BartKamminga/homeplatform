import { useState, useEffect } from 'react'
import { getPositionDistribution } from '../../api.js'

// Item 1232: kans op elke eindplek (simulatie van de rest van de competitie,
// bestaande scenario-engine). Eerst Victoria; de andere teams op verzoek,
// want elke berekening is een simulatie.

const pct = v => (v >= 0.995 ? '100' : v < 0.005 && v > 0 ? '<1' : Math.round(v * 100))

function Bars({ probabilities, highlight }) {
  const entries = Object.entries(probabilities).sort((a, b) => Number(a[0]) - Number(b[0]))
  const max = Math.max(...entries.map(([, v]) => v), 0.0001)
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      {entries.map(([pos, v]) => (
        <div key={pos} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 44px', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <span style={{ fontWeight: 700, color: '#555' }}>{pos}e</span>
          <div style={{ background: '#eef1f8', borderRadius: 999, height: 12, overflow: 'hidden' }}>
            <div style={{ width: `${(v / max) * 100}%`, height: '100%', borderRadius: 999, background: highlight ? 'linear-gradient(90deg, #f4c81e, #ffb24d)' : '#9aa5c0' }} />
          </div>
          <span style={{ textAlign: 'right', fontWeight: 700 }}>{pct(v)}%</span>
        </div>
      ))}
    </div>
  )
}

function TeamChances({ pouleId, team, highlight }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    getPositionDistribution(pouleId, team.team_id).then(setData).catch(e => setError(e.message))
  }, [pouleId, team.team_id])
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{team.name}</div>
      {error ? <p style={{ color: '#c23b3b', fontSize: 12 }}>{error}</p>
        : data ? <Bars probabilities={data.position_probabilities} highlight={highlight} />
          : <p style={{ fontSize: 12, color: '#999' }}>Berekenen...</p>}
    </div>
  )
}

export default function PositionChances({ pouleId, teamId }) {
  const [main, setMain] = useState(null)
  const [error, setError] = useState('')
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    if (!teamId) return
    getPositionDistribution(pouleId, teamId).then(setMain).catch(e => setError(e.message))
  }, [pouleId, teamId])

  if (!teamId) return null
  const others = (main?.standings || []).filter(t => t.team_id !== teamId)

  return (
    <div className="yof-card" style={{ marginBottom: 14 }}>
      <h3 style={{ fontSize: 15, margin: '0 0 4px' }}>Kans op elke eindplek</h3>
      <p style={{ fontSize: 12, color: '#666', margin: '0 0 10px' }}>
        Gesimuleerd op basis van de stand en de nog te spelen wedstrijden in {main?.poule_name || 'de poule'}.
      </p>
      {error && <p style={{ color: '#c23b3b', fontSize: 12 }}>{error}</p>}
      {!main && !error && <p style={{ fontSize: 12, color: '#999' }}>Berekenen...</p>}
      {main && (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{main.team_name}</div>
          <Bars probabilities={main.position_probabilities} highlight />
          <button onClick={() => setShowAll(s => !s)} className="yof-btn-secondary" style={{ marginTop: 12 }}>
            {showAll ? '▾' : '▸'} Kansen van de andere teams
          </button>
          {showAll && (
            <div style={{ marginTop: 10 }}>
              {others.map(t => <TeamChances key={t.team_id} pouleId={pouleId} team={t} />)}
            </div>
          )}
          <details style={{ marginTop: 10, fontSize: 11, color: '#888' }}>
            <summary style={{ cursor: 'pointer' }}>Hoe is dit berekend?</summary>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {(main.caveats || []).map(c => <li key={c}>{c}</li>)}
            </ul>
          </details>
        </>
      )}
    </div>
  )
}
