import { useState, useEffect, useCallback, useRef, useMemo } from 'react'

// ── Constants ──────────────────────────────────────────────────────────────

const API_MATCHES   = '/api/scrapster/matches'
const API_STANDINGS = '/api/scrapster/standings'
const DEFAULT_REFRESH = 60

// ── Helpers ────────────────────────────────────────────────────────────────

function parseDate(str) {
  if (!str) return new Date(0)
  const cleaned = str.trim()
  const dmyMatch = cleaned.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})\s+(\d{2}):(\d{2})/)
  if (dmyMatch) {
    const [, d, m, y, hh, mm] = dmyMatch
    return new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm))
  }
  const iso = new Date(cleaned.replace(' ', 'T'))
  return isNaN(iso.getTime()) ? new Date(0) : iso
}

function formatDatetime(str) {
  if (!str) return '—'
  const d = parseDate(str)
  if (!d || d.getTime() === 0) return str
  const day = d.getDate()
  const month = d.toLocaleString('nl-NL', { month: 'short' })
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${day} ${month} ${hh}:${mm}`
}

function readFiltersFromUrl() {
  const p = new URLSearchParams(window.location.search)
  return {
    venues:       p.getAll('venue'),
    sources:      p.getAll('source'),
    pastFilter:   p.get('past')      || 'laatste3',
    view:         p.get('view')      || 'matches',
    statusFilter: p.get('status')    || 'alle',
    interval:     Number(p.get('interval')) || DEFAULT_REFRESH,
    kiosk:        p.has('kiosk'),
  }
}

function writeFiltersToUrl(venues, sources, pastFilter, view, statusFilter, interval) {
  const p = new URLSearchParams()
  venues.forEach(v => p.append('venue', v))
  sources.forEach(s => p.append('source', s))
  if (pastFilter    && pastFilter    !== 'laatste3')       p.set('past',     pastFilter)
  if (view          && view          !== 'matches')         p.set('view',     view)
  if (statusFilter  && statusFilter  !== 'alle')            p.set('status',   statusFilter)
  if (interval      && interval      !== DEFAULT_REFRESH)   p.set('interval', interval)
  const qs = p.toString()
  history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
}

async function fetchShortToken(venues, sources, pastFilter, view, statusFilter, interval, theme) {
  const res = await fetch('/api/scrapster/shorten', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ venues, sources, pastFilter, view, statusFilter, interval, theme }),
  })
  if (!res.ok) throw new Error('Shorten mislukt')
  const { token } = await res.json()
  return `${window.location.origin}${window.location.pathname}?s=${token}&kiosk=1`
}

async function resolveShortToken(token) {
  const res = await fetch(`/api/scrapster/s/${token}`)
  if (!res.ok) return null
  return res.json()
}

function statusInfo(status) {
  if (!status) return { label: 'Onbekend', cls: 'badge-grey', cat: 'aankomend' }
  const s = status.toLowerCase()
  if (
    s.includes('live') || s.includes('progress') || s.includes('bezig') || s.includes('playing') ||
    s.includes('quarter') || s.includes('half') || s.includes('period') || s.includes('penalty') ||
    /\d+['']/.test(s)
  ) return { label: status, cls: 'badge-live', cat: 'live' }
  if (
    s.includes('finish') || s.includes('played') || s.includes('gespeeld') ||
    s.includes('result') || s.includes('full') || s.includes('complete')
  ) return { label: status, cls: 'badge-done', cat: 'gespeeld' }
  return { label: status, cls: 'badge-upcoming', cat: 'aankomend' }
}

function applyPastFilter(list, pastFilter) {
  const isComplete = m => statusInfo(m.status).cat === 'gespeeld'
  if (pastFilter === 'verberg') return list.filter(m => !isComplete(m))
  if (pastFilter === 'laatste3') {
    const done  = list.filter(isComplete).sort((a, b) => parseDate(b.datetime_str) - parseDate(a.datetime_str)).slice(0, 3)
    const other = list.filter(m => !isComplete(m))
    return [...done, ...other]
  }
  return list
}

// ── Match team helpers ─────────────────────────────────────────────────────

const SUFFIX_RE = /\s+[WM]\d+(?:\/\d+)?$/i

function stripSuffix(name) {
  return name.replace(SUFFIX_RE, '').trim()
}

function isPlaceholderDetails(details) {
  // Only ordinals like "14th A v 15th A" are real placeholders
  return /\b\d+(?:st|nd|rd|th)\b/i.test(details)
}

function parseMatchTeams(details) {
  if (!details || isPlaceholderDetails(details)) return null
  // Strip any trailing parenthesised group: "(W50)", "(MIMC50 B)", etc.
  const cleaned = details.replace(/\s*\([^)]*\)\s*$/, '')
  const parts = cleaned.split(' v ')
  if (parts.length !== 2) return null
  return { home: stripSuffix(parts[0].trim()), away: stripSuffix(parts[1].trim()) }
}

function lookupLogo(map, teamCode) {
  const key = teamCode.toUpperCase().trim()
  if (map[key]) return map[key]
  // Strip trailing variant letter: "ENGB" → "ENG", "AUSB" → "AUS"
  if (key.length > 3 && !/\s/.test(key)) {
    const base = key.slice(0, -1)
    if (map[base]) return map[base]
  }
  // Strip trailing word: "ARG IMC" → "ARG"
  const lastSpace = key.lastIndexOf(' ')
  if (lastSpace > 0) {
    const base = key.slice(0, lastSpace)
    if (map[base]) return map[base]
  }
  return null
}

function parseScore(scoreline) {
  if (!scoreline) return null
  const m = scoreline.match(/^(\d+)[^0-9]+(\d+)$/)
  if (!m) return null
  return { home: Number(m[1]), away: Number(m[2]) }
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ChipGroup({ label, options, selected, onToggle }) {
  return (
    <div className="chip-group">
      <span className="chip-label">{label}</span>
      {options.map(opt => (
        <button
          key={opt}
          className={`chip${selected.includes(opt) ? ' chip-active' : ''}`}
          onClick={() => onToggle(opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

function MatchRow({ match, logoByTeamName, highlight }) {
  const { label: statusLabel, cls: statusCls } = statusInfo(match.status)
  const hasScore = match.scoreline && match.scoreline !== '-' && match.scoreline.trim() !== ''
  const teams = parseMatchTeams(match.details)

  return (
    <tr className="match-row">
      <td className="col-num">{match.match_num}</td>
      <td className="col-datetime">{formatDatetime(match.datetime_str)}</td>
      <td className="col-details">
        {teams ? (
          <div className="match-teams">
            <span className={`team-name${highlight?.side === 'home' ? ' team-scored' : ''}`}>
              {lookupLogo(logoByTeamName, teams.home) && (
                <img src={lookupLogo(logoByTeamName, teams.home)} className="team-flag" alt="" loading="lazy" />
              )}
              {teams.home}
            </span>
            <span className="vs-sep">v</span>
            <span className={`team-name${highlight?.side === 'away' ? ' team-scored' : ''}`}>
              {lookupLogo(logoByTeamName, teams.away) && (
                <img src={lookupLogo(logoByTeamName, teams.away)} className="team-flag" alt="" loading="lazy" />
              )}
              {teams.away}
            </span>
          </div>
        ) : (match.details || '—')}
      </td>
      <td className={`col-score${hasScore ? ' score-set' : ''}${highlight ? ' score-flash' : ''}`}>
        {match.scoreline || '—'}
      </td>
      <td className="col-status"><span className={`badge ${statusCls}`}>{statusLabel}</span></td>
      <td className="col-venue">{match.venue || '—'}</td>
      <td className="col-source"><span className="source-tag">{match.source}</span></td>
    </tr>
  )
}

function StandingsView({ groups, loading }) {
  if (loading) return <div className="empty">Standen ophalen…</div>
  if (!groups.length) return <div className="empty">Geen standen gevonden voor de huidige filters.</div>
  return (
    <div className="standings-grid">
      {groups.map((group, i) => (
        <div key={i} className="standings-card">
          <div className="standings-card-header">
            <span className="standings-competition">{group.competition_name}</span>
            {group.pool_name !== group.competition_name && (
              <span className="standings-pool">{group.pool_name}</span>
            )}
          </div>
          <div className="standings-table-wrap">
            <table className="standings-table">
              <thead>
                <tr>
                  <th className="st-rank">#</th>
                  <th className="st-team">Team</th>
                  <th className="st-num" title="Gespeeld">P</th>
                  <th className="st-num" title="Gewonnen">W</th>
                  <th className="st-num" title="Gelijk">D</th>
                  <th className="st-num" title="Verloren">L</th>
                  <th className="st-num" title="Goals voor">GV</th>
                  <th className="st-num" title="Goals tegen">GT</th>
                  <th className="st-num" title="Doelpuntensaldo">+/-</th>
                  <th className="st-pts" title="Punten">Pts</th>
                </tr>
              </thead>
              <tbody>
                {group.teams.map(team => (
                  <tr key={team.rank} className={`st-row${team.rank <= 2 ? ' st-top' : ''}`}>
                    <td className="st-rank">{team.rank}</td>
                    <td className="st-team">
                      {team.logo_url && <img src={team.logo_url} className="team-flag" alt="" loading="lazy" />}
                      <span>{team.name}</span>
                    </td>
                    <td className="st-num">{team.played}</td>
                    <td className="st-num">{team.won}</td>
                    <td className="st-num">{team.drawn}</td>
                    <td className="st-num">{team.lost}</td>
                    <td className="st-num">{team.goals_for}</td>
                    <td className="st-num">{team.goals_against}</td>
                    <td className={`st-num st-diff${team.goal_diff > 0 ? ' pos' : team.goal_diff < 0 ? ' neg' : ''}`}>
                      {team.goal_diff > 0 ? '+' : ''}{team.goal_diff}
                    </td>
                    <td className="st-pts">{team.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

function CountdownBar({ seconds, total }) {
  const pct = Math.max(0, Math.min(100, (seconds / total) * 100))
  return (
    <div className="countdown-bar-track">
      <div className="countdown-bar-fill" style={{ width: `${pct}%` }} />
    </div>
  )
}

// ── Main App ───────────────────────────────────────────────────────────────

function initTheme() {
  const stored = localStorage.getItem('scrapster-theme')
  if (stored) return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function App() {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastFetched, setLastFetched] = useState(null)
  const [cacheAge, setCacheAge] = useState(null)

  const initFilters = readFiltersFromUrl()
  const shortToken  = new URLSearchParams(window.location.search).get('s')
  const [selectedVenues,  setSelectedVenues]  = useState(initFilters.venues)
  const [selectedSources, setSelectedSources] = useState(initFilters.sources)
  const [pastFilter,   setPastFilter]   = useState(initFilters.pastFilter)
  const [view,         setView]         = useState(initFilters.view)
  const [statusFilter, setStatusFilter] = useState(initFilters.statusFilter)
  const kiosk = initFilters.kiosk || !!shortToken
  const [filterOpen, setFilterOpen] = useState(!kiosk)
  const [copied,    setCopied]    = useState(false)
  const [copyError, setCopyError] = useState(false)
  const [theme, setTheme] = useState(initTheme)

  const [standings,        setStandings]        = useState([])
  const [standingsLoading, setStandingsLoading] = useState(false)

  const [refreshInterval, setRefreshInterval] = useState(initFilters.interval)
  const [countdown, setCountdown] = useState(initFilters.interval)
  const refreshIntervalRef = useRef(refreshInterval)
  useEffect(() => { refreshIntervalRef.current = refreshInterval }, [refreshInterval])

  const prevScoresRef  = useRef({})
  const [goalHighlights, setGoalHighlights] = useState({})

  // Persist theme
  useEffect(() => { localStorage.setItem('scrapster-theme', theme) }, [theme])

  const fetchMatches = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch(API_MATCHES)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const newMatches = json.matches || []
      setMatches(newMatches)
      setLastFetched(new Date())
      setCacheAge(json.cache_age ?? null)

      // Goal detection: diff old vs new scores
      const newHighlights = {}
      for (const m of newMatches) {
        const key = `${m.competition_url}-${m.match_num}`
        const prevScore = prevScoresRef.current[key]
        if (prevScore && m.scoreline && m.scoreline !== '-' && m.scoreline !== prevScore) {
          const cur  = parseScore(m.scoreline)
          const prev = parseScore(prevScore)
          if (cur && prev) {
            const side = cur.home > prev.home ? 'home' : cur.away > prev.away ? 'away' : null
            if (side) {
              const teams = parseMatchTeams(m.details)
              newHighlights[key] = { side, ts: Date.now(), homeTeam: teams?.home || '', awayTeam: teams?.away || '' }
            }
          }
        }
        if (m.scoreline && m.scoreline !== '-') prevScoresRef.current[key] = m.scoreline
      }
      if (Object.keys(newHighlights).length > 0) {
        setGoalHighlights(prev => ({ ...prev, ...newHighlights }))
      }
    } catch (err) {
      setError(err.message || 'Ophalen mislukt')
    } finally {
      setLoading(false)
      setCountdown(refreshIntervalRef.current)
    }
  }, [])

  // Resolve short token → apply filters + view
  useEffect(() => {
    if (!shortToken) return
    resolveShortToken(shortToken).then(f => {
      if (!f) return
      setSelectedVenues(f.venues       || [])
      setSelectedSources(f.sources     || [])
      setPastFilter(f.pastFilter       || 'laatste3')
      setView(f.view                   || 'matches')
      setStatusFilter(f.statusFilter   || 'alle')
      if (f.interval) { setRefreshInterval(f.interval); setCountdown(f.interval) }
      if (f.theme)    { setTheme(f.theme) }
    })
  }, [shortToken])

  // Fetch standings on mount (needed for logo map in matches view) + when switching to standings tab
  useEffect(() => {
    if (standings.length > 0) return
    setStandingsLoading(true)
    fetch(API_STANDINGS)
      .then(r => r.json())
      .then(d => setStandings(d.standings || []))
      .catch(() => {})
      .finally(() => setStandingsLoading(false))
  }, [view, standings.length])

  useEffect(() => { fetchMatches() }, [fetchMatches])

  // Countdown + auto-refresh + highlight expiry
  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { fetchMatches(); return refreshIntervalRef.current }
        return prev - 1
      })
      setGoalHighlights(prev => {
        if (!Object.keys(prev).length) return prev
        const now  = Date.now()
        const next = Object.fromEntries(Object.entries(prev).filter(([, v]) => now - v.ts < 120000))
        return Object.keys(next).length === Object.keys(prev).length ? prev : next
      })
    }, 1000)
    return () => clearInterval(tick)
  }, [fetchMatches])

  // Sync filters to URL
  useEffect(() => {
    writeFiltersToUrl(selectedVenues, selectedSources, pastFilter, view, statusFilter, refreshInterval)
  }, [selectedVenues, selectedSources, pastFilter, view, statusFilter, refreshInterval])

  function copyUrl() {
    setCopyError(false)
    fetchShortToken(selectedVenues, selectedSources, pastFilter, view, statusFilter, refreshInterval, theme)
      .then(url => navigator.clipboard.writeText(url))
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500) })
      .catch(() => { setCopyError(true); setTimeout(() => setCopyError(false), 2500) })
  }

  const allVenues  = [...new Set(matches.map(m => m.venue).filter(Boolean))].sort()
  const allSources = [...new Set(matches.map(m => m.source).filter(Boolean))].sort()

  function toggleVenue(v)  { setSelectedVenues(prev  => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]) }
  function toggleSource(s) { setSelectedSources(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]) }

  // Filter + sort matches
  const filtered = applyPastFilter(
    matches
      .filter(m => selectedVenues.length  === 0 || selectedVenues.includes(m.venue))
      .filter(m => selectedSources.length === 0 || selectedSources.includes(m.source))
      .filter(m => statusFilter === 'alle' || statusInfo(m.status).cat === statusFilter),
    pastFilter
  ).sort((a, b) => parseDate(a.datetime_str) - parseDate(b.datetime_str))

  // Logo lookup map from standings — keyed by UPPERCASE name AND by code extracted from logo URL
  // e.g. "NETHERLANDS" → url, and "NED" → url (from .../flags/round/NED.png)
  const logoByTeamName = useMemo(() => {
    const map = {}
    for (const group of standings) {
      for (const team of group.teams) {
        if (team.logo_url) {
          map[stripSuffix(team.name).toUpperCase()] = team.logo_url
          const m = team.logo_url.match(/\/([A-Z]{2,4})\.png$/i)
          if (m) map[m[1].toUpperCase()] = team.logo_url
        }
      }
    }
    return map
  }, [standings])

  // Filter standings by selected sources
  const filteredStandings = standings.filter(
    s => selectedSources.length === 0 || selectedSources.includes(s.competition_name)
  )

  const timeStr = lastFetched
    ? lastFetched.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—'

  const showFilters = filterOpen

  const STATUS_OPTIONS = [
    ['alle', 'Alle'],
    ['aankomend', 'Aankomend'],
    ['live', 'Live'],
    ['gespeeld', 'Gespeeld'],
  ]

  return (
    <>
      <style>{CSS}</style>
      <div className="app" data-theme={theme}>

        {/* ── Header ── */}
        <header className="header">
          <div className="header-left">
            <span className="logo">🏑</span>
            <div>
              <h1 className="title">World Masters Hockey 2026</h1>
              <p className="subtitle">HC Victoria — Live wedstrijdoverzicht</p>
            </div>
          </div>
          <div className="header-right">
            <div className="status-row">
              {loading && <span className="pill pill-loading">Laden…</span>}
              {error   && <span className="pill pill-error">Fout: {error}</span>}
              {!loading && !error && view === 'matches'  && <span className="pill pill-ok">{filtered.length} wedstrijden</span>}
              {!loading && !error && view === 'standings' && <span className="pill pill-ok">{filteredStandings.length} poules</span>}
              <span className="timestamp">Bijgewerkt {timeStr}</span>
              {cacheAge !== null && cacheAge > 0 && (
                <span className="cache-note">(cache {cacheAge}s oud)</span>
              )}
            </div>
            <CountdownBar seconds={countdown} total={refreshInterval} />
            <div className="refresh-row">
              <span className="refresh-label">Verversen over {countdown}s</span>
              <button className="btn-refresh" onClick={fetchMatches}>Nu verversen</button>
              <label className="interval-label">
                Interval:
                <select
                  className="interval-select"
                  value={refreshInterval}
                  onChange={e => { const val = Number(e.target.value); setRefreshInterval(val); setCountdown(val) }}
                >
                  <option value={30}>30s</option>
                  <option value={60}>1 min</option>
                  <option value={120}>2 min</option>
                  <option value={300}>5 min</option>
                </select>
              </label>
            </div>
          </div>
        </header>

        {/* ── View toggle + filter toggle ── */}
        <div className="view-toggle-bar">
          <button className={`view-btn${view === 'matches'  ? ' view-btn-active' : ''}`} onClick={() => setView('matches')}>Wedstrijden</button>
          <button className={`view-btn${view === 'standings' ? ' view-btn-active' : ''}`} onClick={() => setView('standings')}>Standen</button>
          <button
            className={`view-btn view-btn-filter${filterOpen ? ' view-btn-active' : ''}`}
            onClick={() => setFilterOpen(f => !f)}
            title={filterOpen ? 'Filter verbergen' : 'Filter tonen'}
          >
            {filterOpen ? '▲ Filters' : '▼ Filters'}
          </button>
        </div>

        {/* ── Filters ── */}
        {showFilters && (allVenues.length > 0 || allSources.length > 0) && (
          <section className="filters">
            {allSources.length > 0 && (
              <ChipGroup label="Toernooi:" options={allSources} selected={selectedSources} onToggle={toggleSource} />
            )}
            {view === 'matches' && allVenues.length > 0 && (
              <ChipGroup label="Veld:" options={allVenues} selected={selectedVenues} onToggle={toggleVenue} />
            )}
            {view === 'matches' && (
              <>
                <div className="chip-group">
                  <span className="chip-label">Status:</span>
                  {STATUS_OPTIONS.map(([val, lbl]) => (
                    <button
                      key={val}
                      className={`chip${statusFilter === val ? ' chip-active' : ''}`}
                      onClick={() => setStatusFilter(val)}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
                {(statusFilter === 'alle' || statusFilter === 'gespeeld') && (
                  <div className="chip-group">
                    <span className="chip-label">Afgelopen:</span>
                    {[['alle', 'Toon alles'], ['laatste3', 'Laatste 3'], ['verberg', 'Verberg']].map(([val, lbl]) => (
                      <button
                        key={val}
                        className={`chip${pastFilter === val ? ' chip-active' : ''}`}
                        onClick={() => setPastFilter(val)}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            {(selectedVenues.length > 0 || selectedSources.length > 0) && (
              <button className="btn-clear" onClick={() => { setSelectedVenues([]); setSelectedSources([]) }}>
                Filters wissen
              </button>
            )}
            <button
              className="btn-theme"
              onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
              title={theme === 'dark' ? 'Schakel naar licht' : 'Schakel naar donker'}
            >
              {theme === 'dark' ? '☀ Licht' : '🌙 Donker'}
            </button>
            <button className="btn-copy-url" onClick={copyUrl}>
              {copied ? '✓ Gekopieerd!' : copyError ? '✗ Mislukt' : '🔗 Kopieer link'}
            </button>
          </section>
        )}

        {/* ── Content ── */}
        <main className="main">
          {view === 'matches' ? (
            loading && matches.length === 0 ? (
              <div className="empty">Wedstrijden ophalen…</div>
            ) : error && matches.length === 0 ? (
              <div className="empty error-msg">Kon geen wedstrijden ophalen: {error}</div>
            ) : filtered.length === 0 ? (
              <div className="empty">Geen wedstrijden gevonden voor de huidige filters.</div>
            ) : (
              <div className="table-scroll">
                <table className="match-table">
                  <thead>
                    <tr>
                      <th className="col-num">#</th>
                      <th className="col-datetime">Datum / Tijd</th>
                      <th className="col-details">Wedstrijd</th>
                      <th className="col-score">Score</th>
                      <th className="col-status">Status</th>
                      <th className="col-venue">Veld</th>
                      <th className="col-source">Toernooi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((m, i) => {
                      const key = `${m.competition_url}-${m.match_num}`
                      return (
                        <MatchRow
                          key={`${key}-${i}`}
                          match={m}
                          logoByTeamName={logoByTeamName}
                          highlight={goalHighlights[key]}
                        />
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <StandingsView groups={filteredStandings} loading={standingsLoading} />
          )}
        </main>


      </div>
    </>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────

const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body { font-family: system-ui, -apple-system, sans-serif; min-height: 100vh; }

  /* ── Dark theme (default) ── */
  .app {
    --bg:          #0a1a0f;
    --bg-header:   #112a17;
    --bg-section:  #0d1f12;
    --bg-filter:   #0e2114;
    --bg-card:     #0d2013;
    --bg-row-even: #0d2013;
    --bg-row-hover:#163523;
    --accent:      #4ade80;
    --accent-bg:   #14532d;
    --accent-text: #052e0d;
    --text-1:      #e8f5e9;
    --text-2:      #d1fae5;
    --text-3:      #86efac;
    --text-4:      #6ee7b7;
    --text-5:      #4b8563;
    --text-6:      #a7f3d0;
    --border:      #1e4025;
    --border-2:    #142010;
    --border-3:    #2d6a3f;
    --chip-bg:     #1e4025;
    --chip-hover:  #166534;
    --link-bg:     #1e3a5f;
    --link-fg:     #93c5fd;
    --link-border: #2563eb;
    --link-hover:  #1e40af;
    --link-hover-fg:#bfdbfe;
    --badge-up-bg: #1f2937;
    --badge-up-fg: #9ca3af;
    --btn-refresh-bg:  #166534;
    --btn-refresh-fg:  #bbf7d0;
    --btn-refresh-border: #15803d;
    --btn-refresh-hover: #15803d;

    background: var(--bg);
    color: var(--text-1);
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    max-width: 100vw;
    overflow-x: hidden;
  }

  /* ── Light theme ── */
  .app[data-theme="light"] {
    --bg:          #f0fdf4;
    --bg-header:   #dcfce7;
    --bg-section:  #ecfdf5;
    --bg-filter:   #ecfdf5;
    --bg-card:     #ffffff;
    --bg-row-even: #f7fef9;
    --bg-row-hover:#d1fae5;
    --accent:      #16a34a;
    --accent-bg:   #d1fae5;
    --accent-text: #f0fdf4;
    --text-1:      #14532d;
    --text-2:      #166534;
    --text-3:      #15803d;
    --text-4:      #16a34a;
    --text-5:      #4ade80;
    --text-6:      #166534;
    --border:      #a7f3d0;
    --border-2:    #bbf7d0;
    --border-3:    #4ade80;
    --chip-bg:     #d1fae5;
    --chip-hover:  #a7f3d0;
    --link-bg:     #dbeafe;
    --link-fg:     #1d4ed8;
    --link-border: #3b82f6;
    --link-hover:  #bfdbfe;
    --link-hover-fg:#1d4ed8;
    --badge-up-bg: #f3f4f6;
    --badge-up-fg: #374151;
    --btn-refresh-bg:   #d1fae5;
    --btn-refresh-fg:   #14532d;
    --btn-refresh-border: #4ade80;
    --btn-refresh-hover: #a7f3d0;
  }

  /* ── Header ── */
  .header {
    background: var(--bg-header);
    border-bottom: 2px solid var(--border);
    padding: 1rem 1.5rem;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .header-left { display: flex; align-items: center; gap: 0.75rem; }
  .logo { font-size: 2.5rem; line-height: 1; }

  .title {
    font-size: 1.8rem;
    font-weight: 800;
    color: var(--accent);
    letter-spacing: -0.02em;
    line-height: 1;
  }

  .subtitle { color: var(--text-3); font-size: 0.9rem; margin-top: 0.2rem; }

  .header-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.4rem;
    min-width: 260px;
  }

  .status-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .pill { padding: 0.2rem 0.6rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
  .pill-ok      { background: var(--accent-bg); color: var(--accent); }
  .pill-loading { background: var(--link-bg);   color: var(--link-fg); }
  .pill-error   { background: #450a0a;           color: #f87171; }

  .timestamp  { font-size: 0.75rem; color: var(--text-4); }
  .cache-note { font-size: 0.70rem; color: var(--text-5); }

  .btn-theme {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-4);
    border-radius: 6px;
    padding: 0.2rem 0.5rem;
    font-size: 1rem;
    cursor: pointer;
    line-height: 1.2;
    transition: background 0.15s;
  }
  .btn-theme:hover { background: var(--chip-bg); }

  /* ── Countdown bar ── */
  .countdown-bar-track {
    width: 100%;
    height: 4px;
    background: var(--border);
    border-radius: 2px;
    overflow: hidden;
  }
  .countdown-bar-fill {
    height: 100%;
    background: var(--accent);
    border-radius: 2px;
    transition: width 0.9s linear;
  }

  .refresh-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    justify-content: flex-end;
  }
  .refresh-label { font-size: 0.75rem; color: var(--text-4); }

  .btn-refresh {
    background: var(--btn-refresh-bg);
    color: var(--btn-refresh-fg);
    border: 1px solid var(--btn-refresh-border);
    border-radius: 6px;
    padding: 0.25rem 0.75rem;
    font-size: 0.75rem;
    cursor: pointer;
    transition: background 0.15s;
  }
  .btn-refresh:hover { background: var(--btn-refresh-hover); }

  .interval-label { font-size: 0.75rem; color: var(--text-4); display: flex; align-items: center; gap: 0.3rem; }
  .interval-select {
    background: var(--chip-bg);
    color: var(--text-1);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0.15rem 0.4rem;
    font-size: 0.75rem;
    cursor: pointer;
  }

  /* ── View toggle ── */
  .view-toggle-bar {
    background: var(--bg-section);
    border-bottom: 1px solid var(--border);
    padding: 0.5rem 1.5rem;
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  .view-btn-filter { margin-left: auto; }
  .view-btn {
    background: transparent;
    color: var(--text-4);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.35rem 1rem;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .view-btn:hover { background: var(--chip-hover); color: var(--text-1); }
  .view-btn-active { background: var(--chip-hover); color: var(--accent); border-color: var(--border-3); }

  /* ── Filters ── */
  .filters {
    background: var(--bg-filter);
    border-bottom: 1px solid var(--border);
    padding: 0.75rem 1.5rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: center;
  }

  .chip-group { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
  .chip-label { font-size: 0.75rem; color: var(--text-4); font-weight: 600; white-space: nowrap; }

  .chip {
    background: var(--chip-bg);
    color: var(--text-6);
    border: 1px solid var(--border-3);
    border-radius: 9999px;
    padding: 0.3rem 0.8rem;
    font-size: 0.8rem;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    white-space: nowrap;
  }
  .chip:hover  { background: var(--chip-hover); }
  .chip-active { background: var(--accent); color: var(--accent-text); border-color: var(--accent); font-weight: 700; }

  .btn-clear {
    background: transparent;
    color: #6b7280;
    border: 1px solid #374151;
    border-radius: 6px;
    padding: 0.3rem 0.75rem;
    font-size: 0.75rem;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
  }
  .btn-clear:hover { color: #d1d5db; border-color: #6b7280; }

  .btn-copy-url {
    background: var(--link-bg);
    color: var(--link-fg);
    border: 1px solid var(--link-border);
    border-radius: 6px;
    padding: 0.3rem 0.85rem;
    font-size: 0.75rem;
    cursor: pointer;
    margin-left: auto;
    transition: background 0.15s, color 0.15s;
    white-space: nowrap;
  }
  .btn-copy-url:hover { background: var(--link-hover); color: var(--link-hover-fg); }


  /* ── Main / Table ── */
  .main { flex: 1; padding: 1rem 1.5rem; }

  .empty { text-align: center; padding: 4rem 2rem; color: var(--text-5); font-size: 1.1rem; }
  .error-msg { color: #f87171; }

  .table-scroll { overflow-x: auto; border-radius: 8px; border: 1px solid var(--border); }

  .match-table { width: 100%; border-collapse: collapse; font-size: 1rem; }
  .match-table thead tr { background: var(--bg-header); border-bottom: 2px solid var(--border); }
  .match-table th {
    text-align: left;
    padding: 0.75rem 1rem;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--accent);
    white-space: nowrap;
  }

  .match-row { border-bottom: 1px solid var(--border-2); transition: background 0.1s; }
  .match-row:last-child { border-bottom: none; }
  .match-row:nth-child(even) { background: var(--bg-row-even); }
  .match-row:hover { background: var(--bg-row-hover); }
  .match-row td { padding: 0.8rem 1rem; vertical-align: middle; line-height: 1.3; }

  .col-num      { width: 3.5rem;   color: var(--text-4); font-family: monospace; font-size: 0.9rem; }
  .col-datetime { width: 10rem;    white-space: nowrap; font-size: 0.95rem; color: var(--text-2); }
  .col-details  { min-width: 14rem; font-size: 1.05rem; font-weight: 600; color: var(--text-1); }
  .col-score    { width: 6rem;     text-align: center; font-family: monospace; font-size: 1rem; color: #94a3b8; white-space: nowrap; }
  .col-score.score-set { color: var(--accent); font-size: 1.2rem; font-weight: 800; }
  .col-status   { width: 8rem; }
  .col-venue    { width: 8rem;     font-size: 0.9rem; color: var(--text-3); }
  .col-source   { min-width: 10rem; }

  /* ── Badges ── */
  .badge {
    display: inline-block;
    padding: 0.25rem 0.6rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 700;
    white-space: nowrap;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .badge-upcoming { background: var(--badge-up-bg); color: var(--badge-up-fg); }
  .badge-done     { background: var(--accent-bg); color: var(--accent); }
  .badge-live {
    background: var(--chip-hover);
    color: var(--accent);
    animation: blink 1.4s ease-in-out infinite;
  }
  @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

  .source-tag {
    display: inline-block;
    background: var(--bg-card);
    border: 1px solid var(--border);
    color: var(--text-4);
    padding: 0.2rem 0.55rem;
    border-radius: 4px;
    font-size: 0.75rem;
    line-height: 1.4;
  }

  /* ── Standings ── */
  .standings-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 1.25rem;
    justify-content: center;
  }

  .standings-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    flex: 0 1 520px;
    min-width: 340px;
  }

  .standings-card-header {
    background: var(--bg-header);
    border-bottom: 1px solid var(--border);
    padding: 0.6rem 1rem;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
  }

  .standings-competition { font-size: 0.85rem; font-weight: 700; color: var(--accent); }
  .standings-pool {
    font-size: 0.75rem;
    color: var(--text-4);
    background: var(--chip-bg);
    border: 1px solid var(--border-3);
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
  }

  .standings-table-wrap { overflow-x: auto; }
  .standings-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  .standings-table thead tr { background: var(--bg); border-bottom: 1px solid var(--border); }
  .standings-table th {
    padding: 0.5rem 0.6rem;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--accent);
    white-space: nowrap;
  }

  .st-row { border-bottom: 1px solid var(--border-2); transition: background 0.1s; }
  .st-row:last-child { border-bottom: none; }
  .st-row:hover { background: var(--bg-row-hover); }
  .st-top { background: var(--bg-row-even); }
  .standings-table td { padding: 0.5rem 0.6rem; vertical-align: middle; }

  .st-rank { width: 2rem; color: var(--text-4); font-weight: 700; text-align: center; }
  .st-team { display: flex; align-items: center; gap: 0.5rem; min-width: 120px; font-weight: 600; color: var(--text-1); }
  .st-num  { text-align: right; width: 2.5rem; color: var(--text-6); font-variant-numeric: tabular-nums; }
  .st-pts  { text-align: right; width: 2.5rem; font-weight: 800; color: var(--accent); font-variant-numeric: tabular-nums; }
  .st-diff { font-variant-numeric: tabular-nums; }
  .st-diff.pos { color: var(--accent); }
  .st-diff.neg { color: #f87171; }

  .team-flag { width: 24px; height: 24px; object-fit: contain; flex-shrink: 0; border-radius: 2px; }

  /* ── Match teams (col-details) ── */
  .match-teams { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .team-name   { display: flex; align-items: center; gap: 0.35rem; }
  .vs-sep      { color: var(--text-5); font-size: 0.85rem; font-weight: 500; flex-shrink: 0; }
  .team-scored { color: var(--accent); font-weight: 800; }

  /* ── Goal flash animation ── */
  @keyframes goalFlash {
    0%   { background: var(--accent); color: var(--accent-text); transform: scale(1.1); }
    40%  { background: var(--accent); color: var(--accent-text); transform: scale(1.05); }
    100% { background: transparent;  color: inherit;             transform: scale(1); }
  }
  .score-flash { animation: goalFlash 1.2s ease-out forwards; border-radius: 4px; }

  /* ── Responsive: TV / large ── */
  @media (min-width: 1400px) {
    .title { font-size: 2.2rem; }
    .match-table { font-size: 1.15rem; }
    .match-row td { padding: 1rem 1.25rem; }
    .col-score.score-set { font-size: 1.4rem; }
    .col-details { font-size: 1.2rem; }
    .standings-card { flex-basis: 600px; }
    .standings-table { font-size: 1rem; }
    .standings-table td { padding: 0.65rem 0.75rem; }
    .team-flag { width: 28px; height: 28px; }
  }

  /* ── Responsive: narrow ── */
  @media (max-width: 700px) {
    .header { flex-direction: column; }
    .header-right { align-items: flex-start; width: 100%; }
    .filters { padding: 0.5rem 1rem; }
    .main { padding: 0.5rem; }
    .col-source, .col-num { display: none; }
    .standings-card { flex-basis: 100%; min-width: 0; }
  }
`
