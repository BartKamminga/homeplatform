import { useState, useEffect } from 'react'
import { getPouleMatches } from '../../api.js'

// Item 1229: alle wedstrijden van de poule (niet alleen die van Victoria),
// per speelronde. Altijd zichtbaar: de afgelopen en de volgende ronde; de
// overige rondes achter 1 knop ("Alle rondes tonen"), daarin per ronde uit te klappen.

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
  const [open, setOpen] = useState(() => new Set())
  const [showAll, setShowAll] = useState(false)

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
  const isStarted = r => r.matches.some(m => m.home_score != null)
  const last = [...list].reverse().find(isPlayed)
  const next = list.find(r => !isPlayed(r))
  // Altijd zichtbaar: de afgelopen en de volgende ronde. De rest achter 1 knop.
  const featured = [
    last && { ...last, label: 'Afgelopen ronde' },
    next && { ...next, label: isStarted(next) ? 'Huidige ronde' : 'Volgende ronde' },
  ].filter(Boolean)
  const rest = list.filter(r => !featured.some(f => f.round === r.round))

  function toggle(round) {
    setOpen(prev => {
      const n = new Set(prev)
      n.has(round) ? n.delete(round) : n.add(round)
      return n
    })
  }

  return (
    <div className="yof-card" style={{ marginBottom: 14 }}>
      <h3 style={{ fontSize: 15, margin: '0 0 8px' }}>Uitslagen en programma</h3>
      {featured.map(r => (
        <div key={r.round} style={{ borderTop: '1px solid #eee', paddingBottom: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '8px 2px', fontSize: 13 }}>
            <strong>{r.label} <span style={{ fontWeight: 400, color: '#888' }}>· ronde {r.round}</span></strong>
            <span style={{ color: '#888', fontSize: 12 }}>{fmt(r.matches[0].date)}</span>
          </div>
          {r.matches.map(m => <MatchRow key={m.match_id} m={m} teamName={teamName} />)}
        </div>
      ))}

      {rest.length > 0 && (
        <div style={{ borderTop: '1px solid #eee', paddingTop: 8 }}>
          <button onClick={() => setShowAll(v => !v)} className="yof-btn-secondary">
            {showAll ? '▾ Overige rondes verbergen' : `▸ Alle rondes tonen (${rest.length})`}
          </button>
          {showAll && rest.map(r => (
            <div key={r.round} style={{ borderTop: '1px solid #f3f3f3', marginTop: 6 }}>
              <button onClick={() => toggle(r.round)} style={{
                width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '7px 2px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
              }}>
                <span>{open.has(r.round) ? '▾' : '▸'} Ronde {r.round}</span>
                <span style={{ fontWeight: 400, color: '#888', fontSize: 12 }}>{fmt(r.matches[0].date)}</span>
              </button>
              {open.has(r.round) && <div style={{ paddingBottom: 6 }}>{r.matches.map(m => <MatchRow key={m.match_id} m={m} teamName={teamName} />)}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
