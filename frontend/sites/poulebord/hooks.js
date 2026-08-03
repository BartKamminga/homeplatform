import { useState, useEffect } from 'react'
import { getHockeyPouleStandings, getPhaseStandings } from './api.js'

const _standingsCache = {}

export function useStandings(phaseId) {
  const [data, setData] = useState(_standingsCache[phaseId] ?? null)
  useEffect(() => {
    if (!phaseId) return
    if (_standingsCache[phaseId]) { setData(_standingsCache[phaseId]); return }
    if (String(phaseId).startsWith('disc_')) {
      const pid = parseInt(String(phaseId).replace('disc_', ''), 10)
      getHockeyPouleStandings(pid)
        .then(d => {
          const rows = (d.standings || []).map((r, i) => ({
            id: i, name: r.team_name, pts: r.pts,
            w: r.won, d: r.drawn, l: r.lost, gf: r.gf, ga: r.ga,
          }))
          _standingsCache[phaseId] = rows
          setData(rows)
        })
        .catch(() => setData([]))
    } else {
      getPhaseStandings(phaseId)
        .then(rows => { _standingsCache[phaseId] = rows; setData(rows) })
        .catch(() => setData([]))
    }
  }, [phaseId])
  return data
}
