import { useState, useEffect } from 'react'
import { getPouleMatches } from '../../api.js'

// Item 1229: alle wedstrijden van de poule (niet alleen die van Victoria),
// per speelronde. Laatst gespeelde en eerstvolgende ronde staan open.

const fmt = iso => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })
}

function Logo({ src }) {
  return src
    ? <img src={src} alt="" style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    : <span style={{ width: 18, flexShrink: 0 }} />
}

function MatchRow({ m, teamName }) {
  const ours = m.home === teamName || m.away === teamName
  const played = m.home_score != null && m.away_score != null
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8, padding: '6px 8px',
      fontSize: 12, borderRadius: 8, background: ours ? '#fdf8e8' : 'transparent', fontWeight: ours ? 700 : 400,
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', textAlign: 'right' }}>
        {m.home.replace(' MO14-1', '')} <Logo src={m.home_club_logo} />
      </span>
      <span style={{ minWidth: 44, textAlign: 'center', fontWeight: 800, color: played ? '#12203c' : '#999' }}>
        {played ? `${m.home_score} - ${m.away_score}` : 'vs'}
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Logo src={m.away_club_logo} /> {m.away.replace(' MO14-1', '')}
      </span>
    </div>
  )
}

export default function PouleResults({ pouleId, teamName }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(null)

  useEffect(() => {
    getPouleMatches(pouleId).then(setData).catch(e => setError(e.message))
  }, [pouleId])

  if (error) return <p style={{ color: '#c23b3b', fontSize: 12 }}>{error}</p>
  if (!data) return null

  const all = [...(data.finished || []), ...(data.scheduled || [])]
  const rounds = new Map()
  for (const m of all) {
    const key = m.round ?? fmt(m.date)
    if (!rounds.has(key)) rounds.set(key, [])
    rounds.get(key).push(m)
  }
  const list = [...rounds.entries()]
    .map(([round, matches]) => ({ round, matches: matches.sort((a, b) => (a.date || '').localeCompare(b.date || '')) }))
    .sort((a, b) => (a.matches[0].date || '').localeCompare(b.matches[0].date || ''))
  const isPlayed = r => r.matches.every(m => m.home_score != null)
  const lastPlayed = [...list].reverse().find(isPlayed)?.round
  const next = list.find(r => !isPlayed(r))?.round
  const openSet = open ?? new Set([lastPlayed, next])

  function toggle(round) {
    const n = new Set(openSet)
    n.has(round) ? n.delete(round) : n.add(round)
    setOpen(n)
  }

  return (
    <div className="yof-card" style={{ marginBottom: 14 }}>
      <h3 style={{ fontSize: 15, margin: '0 0 8px' }}>Uitslagen en programma</h3>
      {list.map(r => (
        <div key={r.round} style={{ borderTop: '1px solid #eee' }}>
          <button onClick={() => toggle(r.round)} style={{
            width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 2px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
          }}>
            <span>{openSet.has(r.round) ? '▾' : '▸'} Ronde {r.round}{r.round === next ? ' · volgende' : ''}</span>
            <span style={{ fontWeight: 400, color: '#888', fontSize: 12 }}>{fmt(r.matches[0].date)}</span>
          </button>
          {openSet.has(r.round) && <div style={{ paddingBottom: 8 }}>{r.matches.map(m => <MatchRow key={m.match_id} m={m} teamName={teamName} />)}</div>}
        </div>
      ))}
    </div>
  )
}
