import { useState, useEffect } from 'react'
import { getPouleMatches } from '../../api.js'
import { fmtRoundDate } from './MatchRow.jsx'
import RoundRolodex from './RoundRolodex.jsx'

// Item 1229: alle wedstrijden van de poule (niet alleen die van Victoria),
// per speelronde, als rolodex: altijd 2 rondes in beeld (start: afgelopen +
// volgende ronde), bladeren schuift 1 ronde op. Zie RoundRolodex.

export default function PouleResults({ pouleId, teamName }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getPouleMatches(pouleId).then(setData).catch(e => setError(e.message))
  }, [pouleId])

  if (error) return <p style={{ color: '#c23b3b', fontSize: 12 }}>{error}</p>
  if (!data) return null

  const all = [...(data.finished || []), ...(data.scheduled || [])]
  if (all.length === 0) return null
  const rounds = new Map()
  for (const m of all) {
    const key = m.round ?? fmtRoundDate(m.date)
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
  const labels = {}
  if (last) labels[last.round] = 'Afgelopen ronde'
  if (next) labels[next.round] = isStarted(next) ? 'Huidige ronde' : 'Volgende ronde'
  // Venster van 2 start op de afgelopen ronde (dan staat de volgende ernaast).
  const startIndex = last ? list.indexOf(last) : 0

  return (
    <div className="yof-card" style={{ marginBottom: 14 }}>
      <h3 style={{ fontSize: 15, margin: '0 0 8px' }}>Uitslagen en programma</h3>
      <RoundRolodex rounds={list} startIndex={startIndex} isPlayed={isPlayed} labels={labels} teamName={teamName} />
    </div>
  )
}
