import { useState, useEffect, useMemo } from 'react'
import {
  getHockeyPouleStandings, getPhaseStandings, getTagRanking, getTagRoundScorers, getTagRoundMatches,
  getUpcomingMatches, getClubRanking, getTournamentCompetitionStandings, getPhases,
  getHockeyPublications, getDiscoverySeason,
} from './api.js'
import { SEASON, PINS_KEY, POOL_PINS_KEY, QUERY_PINS_KEY, FILTER_PINS_KEY } from './constants.js'

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
            id: i, team_id: r.team_id, name: r.team_name, pts: r.pts, club_logo_url: r.club_logo_url,
            w: r.won, d: r.drawn, l: r.lost, gf: r.gf, ga: r.ga, note: r.ai_note,
          }))
          rows.ai_note = d.ai_note  // poule-niveau notitie (item 957) - meegelift op de array, zie PinnedBoard.jsx
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

// Gedeeld door TournamentCard (TournixBrowseCards.jsx) en CompactPinnedCard
// (PinnedBoard.jsx): haalt de discovery-competitiestandigen op, groepeert per
// fase-tag, en valt terug op Tournix-fases als er geen discovery-koppeling is.
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
  const { tournamentId, template, stat, scope, limit } = pin
  // pin.tag (enkelvoud) is de oude vorm van vóór multi-tag-filtering (item 669) -
  // gepinde kaarten van vóór die wijziging hebben nog geen pin.tags in hun localStorage.
  const tags = pin.tags ?? (pin.tag ? [pin.tag] : [])
  const tagKey = [...tags].sort().join(',')
  const cacheKey = `${tournamentId}::${tagKey}::${template}::${stat || ''}::${scope || ''}::${limit}`
  const [data, setData] = useState(() => getCachedQuery(cacheKey))
  useEffect(() => {
    const cached = getCachedQuery(cacheKey)
    if (cached) { setData(cached); return }
    setData(null)
    const req = template === 'round_scorers'
      ? getTagRoundScorers(tournamentId, tags, stat, limit)
      : template === 'round_matches'
        ? getTagRoundMatches(tournamentId, tags, stat, scope || 'round', limit)
        : template === 'upcoming_matches'
          ? getUpcomingMatches(tournamentId, tags, limit)
          : template === 'club_ranking'
            ? getClubRanking(tournamentId, tags, limit)
            : getTagRanking(tournamentId, tags, stat, limit)
    req
      .then(d => { _queryCache[cacheKey] = { rows: d.rows || [], ts: Date.now() }; setData(d.rows || []) })
      .catch(() => setData([]))
  }, [cacheKey])
  return data
}

// item 692: publicatie/tag/browse-state uit App.jsx - seizoen+publicatielijst,
// geselecteerde publicatie, tag-filters, en het pendingNav-navigatiemechanisme
// (items 676/683: wacht tot pubComps voor de juiste publicatie geladen is
// voordat tags/competitie worden toegepast, anders overschrijft het
// selectedPub-reset-effect ze weer).
export function usePublicationBrowse() {
  const [season, setSeason]                 = useState(SEASON)
  const [allRaw, setAllRaw]                 = useState(null)
  const [error, setError]                   = useState(null)
  const [selectedPub, setSelectedPub]       = useState(null)
  const [tagFilters, setTagFilters]         = useState(() => new Set())
  const [pubComps, setPubComps]             = useState(null)
  const [pubCompsFor, setPubCompsFor]       = useState(null)
  const [expandedCompId, setExpandedCompId] = useState(null)
  const [pendingNav, setPendingNav]         = useState(null)

  const all = useMemo(() => {
    if (allRaw === null) return null
    const norm = s => (s || '').replace(/\s*-\s*/g, '-')
    return allRaw.filter(t => norm(t.season) === norm(season))
  }, [allRaw, season])

  useEffect(() => {
    getDiscoverySeason().then(r => { if (r.season) setSeason(r.season) }).catch(() => {})
  }, [])

  useEffect(() => {
    getHockeyPublications().then(setAllRaw).catch(() => setError('Kon publicaties niet laden'))
  }, [])

  useEffect(() => {
    if (!all) return
    if (!all.find(t => t.id === selectedPub?.id)) setSelectedPub(all[0] || null)
  }, [all])

  useEffect(() => {
    if (!selectedPub) { setPubComps(null); setPubCompsFor(null); return }
    setPubComps(null)
    setPubCompsFor(null)
    setTagFilters(new Set())
    setExpandedCompId(null)
    getTournamentCompetitionStandings(selectedPub.id)
      .then(data => { setPubComps(data.competitions || []); setPubCompsFor(selectedPub.id) })
      .catch(() => { setPubComps([]); setPubCompsFor(selectedPub.id) })
  }, [selectedPub])

  useEffect(() => {
    if (!pendingNav || pubCompsFor !== pendingNav.tournamentId || !pubComps) return
    if (pendingNav.pouleId != null) {
      const comp = pubComps.find(c => (c.poules || []).some(p => p.id === pendingNav.pouleId))
      if (comp) {
        setExpandedCompId(comp.link_id)
        setTagFilters(new Set((comp.fase_tags || []).map(t => t.name)))
      }
    } else if (pendingNav.tags) {
      setTagFilters(new Set(pendingNav.tags))
    }
    setPendingNav(null)
  }, [pendingNav, pubComps, pubCompsFor])

  function toggleTagFilter(tag) {
    setTagFilters(prev => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }

  function clearTagFilters() { setTagFilters(new Set()) }

  // Selecteert een publicatie (+ evt. specifieke poule of directe tags) op
  // basis van een tournamentId - gebruikt door zoekresultaten (676) en gepinde
  // filters (683). Sluiten van search/board-modi is aan de aanroeper (App.jsx),
  // dat is UI-mode-state, geen publicatie-browse-state. Retourneert false als
  // de publicatie niet (meer) bestaat.
  function navigateTo({ tournamentId, tags, pouleId }) {
    const t = (all || []).find(x => x.id === tournamentId)
    if (!t) return false
    setSelectedPub(t)
    if (pouleId != null) setPendingNav({ tournamentId: t.id, pouleId })
    else if (tags) setPendingNav({ tournamentId: t.id, tags })
    return true
  }

  // item 749: categorie meegeven per tag (puur organisatorisch, groepeert
  // alleen de weergave in BrowseView - de AND-filterlogica werkt nog steeds
  // op tag-naam, ongewijzigd).
  const allTags = pubComps
    ? [...new Map(
        pubComps.flatMap(c => c.fase_tags || [])
          .map(t => [t.name, { name: t.name, category_name: t.category_name, category_order: t.category_order }])
      ).values()]
    : []
  const filteredComps = !pubComps ? [] : tagFilters.size === 0 ? pubComps
    : pubComps.filter(c => {
        const names = new Set((c.fase_tags || []).map(t => t.name))
        return [...tagFilters].every(tag => names.has(tag))
      })

  return {
    all, error, selectedPub, setSelectedPub,
    tagFilters, toggleTagFilter, clearTagFilters,
    pubComps, expandedCompId, setExpandedCompId,
    allTags, filteredComps, navigateTo,
  }
}

// item 692: alle pin-datasets (competitie/poule/query/filter) + hun CRUD uit
// App.jsx - puur data-operaties, geen navigatie/UI-mode-logica.
export function usePoulebordPins() {
  const [pins, setPins, setPinsRaw] = usePersistedState(PINS_KEY, {
    serialize: s => [...s], deserialize: arr => new Set(arr), initial: () => new Set(),
  })
  const [poolPins, setPoolPins, setPoolPinsRaw] = usePersistedState(POOL_PINS_KEY, {
    serialize: m => [...m.values()],
    deserialize: arr => new Map(arr.map(p => [`${p.phaseId}::${p.poolName}`, p])),
    initial: () => new Map(),
  })
  const [queryPins, setQueryPins] = usePersistedState(QUERY_PINS_KEY, {
    serialize: m => [...m.entries()], deserialize: arr => new Map(arr), initial: () => new Map(),
  })
  const [filterPins, setFilterPins] = usePersistedState(FILTER_PINS_KEY, {
    serialize: m => [...m.entries()], deserialize: arr => new Map(arr), initial: () => new Map(),
  })

  function togglePin(tid) {
    setPins(prev => {
      const next = new Set(prev)
      if (next.has(tid)) next.delete(tid)
      else next.add(tid)
      return next
    })
  }

  function togglePoolPin(phaseId, poolName, tournamentName, compName) {
    const key = `${phaseId}::${poolName}`
    setPoolPins(prev => {
      const next = new Map(prev)
      if (next.has(key)) next.delete(key)
      else next.set(key, { phaseId, poolName, tournamentName, compName })
      return next
    })
  }

  function setQueryPin(key, cfg) {
    setQueryPins(prev => new Map(prev).set(key, cfg))
  }

  function updateQueryPin(key, patch) {
    setQueryPins(prev => {
      const cur = prev.get(key)
      if (!cur) return prev
      return new Map(prev).set(key, { ...cur, ...patch })
    })
  }

  function removeQueryPin(key) {
    setQueryPins(prev => {
      const next = new Map(prev)
      next.delete(key)
      return next
    })
  }

  function filterPinKey(tid, tags) {
    return `${tid}::${[...tags].sort().join(',')}`
  }

  function toggleFilterPin(selectedPub, tagFilters) {
    if (!selectedPub) return
    const key = filterPinKey(selectedPub.id, tagFilters)
    setFilterPins(prev => {
      const next = new Map(prev)
      if (next.has(key)) next.delete(key)
      else next.set(key, {
        tournamentId: selectedPub.id, tournamentName: selectedPub.name, tags: [...tagFilters],
      })
      return next
    })
  }

  function removeFilterPin(key) {
    setFilterPins(prev => {
      const next = new Map(prev)
      next.delete(key)
      return next
    })
  }

  return {
    pins, setPins, setPinsRaw, poolPins, setPoolPins, setPoolPinsRaw, queryPins, filterPins,
    togglePin, togglePoolPin, setQueryPin, updateQueryPin, removeQueryPin,
    filterPinKey, toggleFilterPin, removeFilterPin,
  }
}
