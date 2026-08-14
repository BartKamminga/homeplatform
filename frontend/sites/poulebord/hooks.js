import { useState, useEffect } from 'react'
import { getHockeyPouleStandings, getPhaseStandings } from './api.js'

const _standingsCache = {}
const CACHE_TTL = 5 * 60 * 1000

function getCached(key) {
  const entry = _standingsCache[key]
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL) { delete _standingsCache[key]; return null }
  return entry.rows
}

export function useStandings(phaseId) {
  const [data, setData] = useState(() => getCached(phaseId))
  useEffect(() => {
    if (!phaseId) return
    const cached = getCached(phaseId)
    if (cached) { setData(cached); return }
    if (String(phaseId).startsWith('disc_')) {
      const pid = parseInt(String(phaseId).replace('disc_', ''), 10)
      getHockeyPouleStandings(pid)
        .then(d => {
          const rows = (d.standings || []).map((r, i) => ({
            id: i, name: r.team_name, pts: r.pts,
            w: r.won, d: r.drawn, l: r.lost, gf: r.gf, ga: r.ga,
          }))
          _standingsCache[phaseId] = { rows, ts: Date.now() }
          setData(rows)
        })
        .catch(() => setData([]))
    } else {
      getPhaseStandings(phaseId)
        .then(rows => { _standingsCache[phaseId] = { rows, ts: Date.now() }; setData(rows) })
        .catch(() => setData([]))
    }
  }, [phaseId])
  return data
}
