import { useState, useEffect } from 'react'
import {
  getHockeyPouleStandings, getPhaseStandings, getTagRanking, getTagRoundScorers, getTagRoundMatches,
  getUpcomingMatches, getWinStreak, getClubRanking, getTournamentCompetitionStandings, getPhases,
} from './api.js'

// Generieke localStorage-gebonden state (Set/Map met JSON-serialisatie).
// Bewaart het exacte opslagformaat per gebruik via serialize/deserialize, zodat
// bestaande localStorage-data (pins, poolPins, queryPins) leesbaar blijft.
// Geeft ook de "kale" setState terug voor gevallen waarin state wel gewijzigd
// moet worden maar NIET gepersisteerd (bv. een gedeeld board tijdelijk bekijken).
export function usePersistedState(storageKey, { serialize, deserialize, initial }) {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      return raw != null ? deserialize(JSON.parse(raw)) : initial()
    } catch { return initial() }
  })
  function persist(updater) {
    setState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      localStorage.setItem(storageKey, JSON.stringify(serialize(next)))
      return next
    })
  }
  return [state, persist, setState]
}

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
            id: i, name: r.team_name, pts: r.pts, club_logo_url: r.club_logo_url,
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

// Gedeeld door TournamentCard en CompactPinnedCard (BoardView.jsx): haalt de
// discovery-competitiestandigen op, groepeert per fase-tag, en valt terug op
// Tournix-fases als er geen discovery-koppeling is.
export function useTournamentStandings(tournamentId) {
  const [phases,       setPhases]       = useState(null)
  const [fasesData,    setFasesData]    = useState(null)
  const [useDiscovery, setUseDiscovery] = useState(null)

  useEffect(() => {
    getTournamentCompetitionStandings(tournamentId)
      .then(data => {
        const comps = data.competitions || []
        if (comps.length > 0) {
          const byLabel = {}
          for (const comp of comps) {
            const label = comp.fase_tags?.[0]?.name || 'Competitie'
            if (!byLabel[label]) byLabel[label] = []
            byLabel[label].push(comp)
          }
          setFasesData(Object.entries(byLabel).map(([label, competitions]) => ({ fase: label, label, competitions })))
          setUseDiscovery(true)
        } else {
          setUseDiscovery(false)
        }
      })
      .catch(() => setUseDiscovery(false))
  }, [tournamentId])

  useEffect(() => {
    if (useDiscovery === false) {
      getPhases(tournamentId).then(setPhases).catch(() => setPhases([]))
    }
  }, [useDiscovery, tournamentId])

  const poolPhases = phases?.filter(p =>
    p.phase_type === 'pool' && (p.is_main_phase || p.pools?.some(pool => pool.team_count > 0))
  ) ?? []

  return { fasesData, useDiscovery, phases, poolPhases }
}

const _queryCache = {}

function getCachedQuery(key) {
  const entry = _queryCache[key]
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL) { delete _queryCache[key]; return null }
  return entry.rows
}

export function useQueryResult(pin) {
  const { tournamentId, tag, template, stat, scope, limit } = pin
  const cacheKey = `${tournamentId}::${tag || ''}::${template}::${stat || ''}::${scope || ''}::${limit}`
  const [data, setData] = useState(() => getCachedQuery(cacheKey))
  useEffect(() => {
    const cached = getCachedQuery(cacheKey)
    if (cached) { setData(cached); return }
    setData(null)
    const req = template === 'round_scorers'
      ? getTagRoundScorers(tournamentId, tag, stat, scope || 'round', limit)
      : template === 'round_matches'
        ? getTagRoundMatches(tournamentId, tag, stat, scope || 'round', limit)
        : template === 'upcoming_matches'
          ? getUpcomingMatches(tournamentId, tag, stat, limit)
          : template === 'win_streak'
            ? getWinStreak(tournamentId, tag, limit)
            : template === 'club_ranking'
              ? getClubRanking(tournamentId, tag, limit)
              : getTagRanking(tournamentId, tag, stat, limit)
    req
      .then(d => { _queryCache[cacheKey] = { rows: d.rows || [], ts: Date.now() }; setData(d.rows || []) })
      .catch(() => setData([]))
  }, [cacheKey])
  return data
}
