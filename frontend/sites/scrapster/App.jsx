import { useState, useEffect, useCallback, useRef } from 'react'

// ── Constants ──────────────────────────────────────────────────────────────

const API_MATCHES  = '/api/scrapster/matches'
const API_STANDINGS = '/api/scrapster/standings'
const DEFAULT_REFRESH = 60 // seconds

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
    venues: p.getAll('venue'),
    sources: p.getAll('source'),
    pastFilter: p.get('past') || 'laatste3',
    view: p.get('view') || 'matches',
    kiosk: p.has('kiosk'),
  }
}

function writeFiltersToUrl(venues, sources, pastFilter, view) {
  const p = new URLSearchParams()
  venues.forEach(v => p.append('venue', v))
  sources.forEach(s => p.append('source', s))
  if (pastFilter && pastFilter !== 'laatste3') p.set('past', pastFilter)
  if (view && view !== 'matches') p.set('view', view)
  // kiosk param is never written back to the live URL — only added by copyUrl()
  const qs = p.toString()
  history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
}

async function fetchShortToken(venues, sources, pastFilter, view) {
  const res = await fetch('/api/scrapster/shorten', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ venues, sources, pastFilter, view }),
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

function applyPastFilter(list, pastFilter) {
  const isComplete = m => m.status.toLowerCase().includes('complete')
  if (pastFilter === 'verberg') return list.filter(m => !isComplete(m))
  if (pastFilter === 'laatste3') {
    const done = list.filter(isComplete).sort((a, b) => parseDate(b.datetime_str) - parseDate(a.datetime_str)).slice(0, 3)
    const other = list.filter(m => !isComplete(m))
    return [...done, ...other]
  }
  return list
}

function statusInfo(status) {
  if (!status) return { label: 'Onbekend', cls: 'badge-grey' }
  const s = status.toLowerCase()
  if (
    s.includes('live') || s.includes('progress') || s.includes('bezig') || s.includes('playing') ||
    s.includes('quarter') || s.includes('half') || s.includes('period') || s.includes('penalty') ||
    /\d+['']/.test(s)
  ) {
    return { label: status, cls: 'badge-live' }
  }
  if (
    s.includes('finish') || s.includes('played') || s.includes('gespeeld') ||
    s.includes('result') || s.includes('full') || s.includes('complete')
  ) {
    return { label: status, cls: 'badge-done' }
  }
  return { label: status, cls: 'badge-upcoming' }
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

function MatchRow({ match }) {
  const { label: statusLabel, cls: statusCls } = statusInfo(match.status)
  const hasScore = match.scoreline && match.scoreline !== '-' && match.scoreline.trim() !== ''

  return (
    <tr className="match-row">
      <td className="col-num">{match.match_num}</td>
      <td className="col-datetime">{formatDatetime(match.datetime_str)}</td>
      <td className="col-details">{match.details || '—'}</td>
      <td className={`col-score${hasScore ? ' score-set' : ''}`}>
        {match.scoreline || '—'}
      </td>
      <td className="col-status">
        <span className={`badge ${statusCls}`}>{statusLabel}</span>
      </td>
      <td className="col-venue">{match.venue || '—'}</td>
      <td className="col-source">
        <span className="source-tag">{match.source}</span>
      </td>
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
                      {team.logo_url && (
                        <img src={team.logo_url} className="team-flag" alt="" loading="lazy" />
                      )}
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

export default function App() {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastFetched, setLastFetched] = useState(null)
  const [cacheAge, setCacheAge] = useState(null)

  const initFilters = readFiltersFromUrl()
  const shortToken = new URLSearchParams(window.location.search).get('s')
  const [selectedVenues, setSelectedVenues] = useState(initFilters.venues)
  const [selectedSources, setSelectedSources] = useState(initFilters.sources)
  const [pastFilter, setPastFilter] = useState(initFilters.pastFilter)
  const [view, setView] = useState(initFilters.view)
  const kiosk = initFilters.kiosk || !!shortToken
  const [filterOpen, setFilterOpen] = useState(!kiosk)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)

  const [standings, setStandings] = useState([])
  const [standingsLoading, setStandingsLoading] = useState(false)

  const [refreshInterval, setRefreshInterval] = useState(DEFAULT_REFRESH)
  const [countdown, setCountdown] = useState(DEFAULT_REFRESH)

  const refreshIntervalRef = useRef(refreshInterval)
  useEffect(() => { refreshIntervalRef.current = refreshInterval }, [refreshInterval])

  const fetchMatches = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch(API_MATCHES)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setMatches(json.matches || [])
      setLastFetched(new Date())
      setCacheAge(json.cache_age ?? null)
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
      setSelectedVenues(f.venues || [])
      setSelectedSources(f.sources || [])
      setPastFilter(f.pastFilter || 'laatste3')
      setView(f.view || 'matches')
    })
  }, [shortToken])

  // Fetch standings when switching to standings view
  useEffect(() => {
    if (view !== 'standings' || standings.length > 0) return
    setStandingsLoading(true)
    fetch(API_STANDINGS)
      .then(r => r.json())
      .then(d => setStandings(d.standings || []))
      .catch(() => {})
      .finally(() => setStandingsLoading(false))
  }, [view, standings.length])

  // Initial fetch
  useEffect(() => { fetchMatches() }, [fetchMatches])

  // Countdown tick + auto-refresh
  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { fetchMatches(); return refreshIntervalRef.current }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(tick)
  }, [fetchMatches])

  // Sync filters + view to URL
  useEffect(() => {
    writeFiltersToUrl(selectedVenues, selectedSources, pastFilter, view)
  }, [selectedVenues, selectedSources, pastFilter, view])

  function copyUrl() {
    setCopyError(false)
    fetchShortToken(selectedVenues, selectedSources, pastFilter, view)
      .then(url => navigator.clipboard.writeText(url))
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500) })
      .catch(() => { setCopyError(true); setTimeout(() => setCopyError(false), 2500) })
  }

  const allVenues = [...new Set(matches.map(m => m.venue).filter(Boolean))].sort()
  const allSources = [...new Set(matches.map(m => m.source).filter(Boolean))].sort()

  function toggleVenue(v) {
    setSelectedVenues(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])
  }
  function toggleSource(s) {
    setSelectedSources(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  // Filter + sort matches
  const filtered = applyPastFilter(
    matches
      .filter(m => selectedVenues.length === 0 || selectedVenues.includes(m.venue))
      .filter(m => selectedSources.length === 0 || selectedSources.includes(m.source)),
    pastFilter
  ).sort((a, b) => parseDate(a.datetime_str) - parseDate(b.datetime_str))

  // Filter standings by selected sources
  const filteredStandings = standings.filter(
    s => selectedSources.length === 0 || selectedSources.includes(s.competition_name)
  )

  const timeStr = lastFetched
    ? lastFetched.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—'

  const showFilters = !kiosk || filterOpen

  return (
    <>
      <style>{CSS}</style>
      <div className="app">

        {/* ── Header ── */}
        <header className="header">
          <div className="header-left">
            <span className="logo">🏑</span>
            <div>
              <h1 className="title">HC Victoria</h1>
              <p className="subtitle">WMH Rotterdam 2026 — Live wedstrijdoverzicht</p>
            </div>
          </div>
          <div className="header-right">
            <div className="status-row">
              {loading && <span className="pill pill-loading">Laden…</span>}
              {error && <span className="pill pill-error">Fout: {error}</span>}
              {!loading && !error && view === 'matches' && (
                <span className="pill pill-ok">{filtered.length} wedstrijden</span>
              )}
              {!loading && !error && view === 'standings' && (
                <span className="pill pill-ok">{filteredStandings.length} poules</span>
              )}
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
                  onChange={e => {
                    const val = Number(e.target.value)
                    setRefreshInterval(val)
                    setCountdown(val)
                  }}
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

        {/* ── View toggle ── */}
        <div className="view-toggle-bar">
          <button
            className={`view-btn${view === 'matches' ? ' view-btn-active' : ''}`}
            onClick={() => setView('matches')}
          >
            Wedstrijden
          </button>
          <button
            className={`view-btn${view === 'standings' ? ' view-btn-active' : ''}`}
            onClick={() => setView('standings')}
          >
            Standen
          </button>
        </div>

        {/* ── Filters ── */}
        {showFilters && (allVenues.length > 0 || allSources.length > 0) && (
          <section className="filters">
            {allSources.length > 0 && (
              <ChipGroup
                label="Toernooi:"
                options={allSources}
                selected={selectedSources}
                onToggle={toggleSource}
              />
            )}
            {view === 'matches' && allVenues.length > 0 && (
              <ChipGroup
                label="Veld:"
                options={allVenues}
                selected={selectedVenues}
                onToggle={toggleVenue}
              />
            )}
            {view === 'matches' && (
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
            {(selectedVenues.length > 0 || selectedSources.length > 0) && (
              <button
                className="btn-clear"
                onClick={() => { setSelectedVenues([]); setSelectedSources([]) }}
              >
                Filters wissen
              </button>
            )}
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
                    {filtered.map((m, i) => (
                      <MatchRow key={`${m.competition_url}-${m.match_num}-${i}`} match={m} />
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <StandingsView groups={filteredStandings} loading={standingsLoading} />
          )}
        </main>

        {/* ── Kiosk filter toggle ── */}
        {kiosk && (
          <button
            className="btn-kiosk-filter"
            onClick={() => setFilterOpen(f => !f)}
            title={filterOpen ? 'Filter verbergen' : 'Filter tonen'}
          >
            {filterOpen ? '✕' : '⚙'}
          </button>
        )}

      </div>
    </>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────

const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: #0a1a0f;
    color: #e8f5e9;
    font-family: system-ui, -apple-system, sans-serif;
    min-height: 100vh;
  }

  .app {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    max-width: 100vw;
    overflow-x: hidden;
  }

  /* ── Header ── */
  .header {
    background: #112a17;
    border-bottom: 2px solid #1e4025;
    padding: 1rem 1.5rem;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .logo { font-size: 2.5rem; line-height: 1; }

  .title {
    font-size: 2rem;
    font-weight: 800;
    color: #4ade80;
    letter-spacing: -0.02em;
    line-height: 1;
  }

  .subtitle {
    color: #86efac;
    font-size: 0.9rem;
    margin-top: 0.2rem;
  }

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

  .pill {
    padding: 0.2rem 0.6rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .pill-ok      { background: #14532d; color: #4ade80; }
  .pill-loading { background: #1e3a5f; color: #93c5fd; }
  .pill-error   { background: #450a0a; color: #f87171; }

  .timestamp  { font-size: 0.75rem; color: #6ee7b7; }
  .cache-note { font-size: 0.7rem;  color: #4b8563; }

  /* ── Countdown bar ── */
  .countdown-bar-track {
    width: 100%;
    height: 4px;
    background: #1e4025;
    border-radius: 2px;
    overflow: hidden;
  }

  .countdown-bar-fill {
    height: 100%;
    background: #4ade80;
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

  .refresh-label { font-size: 0.75rem; color: #6ee7b7; }

  .btn-refresh {
    background: #166534;
    color: #bbf7d0;
    border: 1px solid #15803d;
    border-radius: 6px;
    padding: 0.25rem 0.75rem;
    font-size: 0.75rem;
    cursor: pointer;
    transition: background 0.15s;
  }
  .btn-refresh:hover { background: #15803d; }

  .interval-label {
    font-size: 0.75rem;
    color: #6ee7b7;
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }

  .interval-select {
    background: #1e4025;
    color: #e8f5e9;
    border: 1px solid #15803d;
    border-radius: 4px;
    padding: 0.15rem 0.4rem;
    font-size: 0.75rem;
    cursor: pointer;
  }

  /* ── View toggle ── */
  .view-toggle-bar {
    background: #0d1f12;
    border-bottom: 1px solid #1e4025;
    padding: 0.5rem 1.5rem;
    display: flex;
    gap: 0.5rem;
  }

  .view-btn {
    background: transparent;
    color: #6ee7b7;
    border: 1px solid #1e4025;
    border-radius: 6px;
    padding: 0.35rem 1rem;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .view-btn:hover { background: #1a3a22; color: #a7f3d0; }
  .view-btn-active {
    background: #166534;
    color: #4ade80;
    border-color: #15803d;
  }

  /* ── Filters ── */
  .filters {
    background: #0e2114;
    border-bottom: 1px solid #1e4025;
    padding: 0.75rem 1.5rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: center;
  }

  .chip-group {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .chip-label {
    font-size: 0.75rem;
    color: #6ee7b7;
    font-weight: 600;
    white-space: nowrap;
  }

  .chip {
    background: #1e4025;
    color: #a7f3d0;
    border: 1px solid #2d6a3f;
    border-radius: 9999px;
    padding: 0.3rem 0.8rem;
    font-size: 0.8rem;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    white-space: nowrap;
  }
  .chip:hover  { background: #166534; }
  .chip-active { background: #4ade80; color: #052e0d; border-color: #4ade80; font-weight: 700; }

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
    background: #1e3a5f;
    color: #93c5fd;
    border: 1px solid #2563eb;
    border-radius: 6px;
    padding: 0.3rem 0.85rem;
    font-size: 0.75rem;
    cursor: pointer;
    margin-left: auto;
    transition: background 0.15s, color 0.15s;
    white-space: nowrap;
  }
  .btn-copy-url:hover { background: #1e40af; color: #bfdbfe; }

  /* ── Kiosk filter toggle ── */
  .btn-kiosk-filter {
    position: fixed;
    bottom: 1.25rem;
    right: 1.25rem;
    width: 2.5rem;
    height: 2.5rem;
    background: #1e3a5f;
    color: #93c5fd;
    border: 1px solid #2563eb;
    border-radius: 50%;
    font-size: 1.1rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(0,0,0,0.5);
    transition: background 0.15s, color 0.15s;
    z-index: 100;
  }
  .btn-kiosk-filter:hover { background: #1e40af; color: #bfdbfe; }

  /* ── Main / Table ── */
  .main {
    flex: 1;
    padding: 1rem 1.5rem;
  }

  .empty {
    text-align: center;
    padding: 4rem 2rem;
    color: #4b8563;
    font-size: 1.1rem;
  }

  .error-msg { color: #f87171; }

  .table-scroll {
    overflow-x: auto;
    border-radius: 8px;
    border: 1px solid #1e4025;
  }

  .match-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 1rem;
  }

  .match-table thead tr {
    background: #112a17;
    border-bottom: 2px solid #1e4025;
  }

  .match-table th {
    text-align: left;
    padding: 0.75rem 1rem;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #4ade80;
    white-space: nowrap;
  }

  .match-row {
    border-bottom: 1px solid #1a3020;
    transition: background 0.1s;
  }
  .match-row:last-child { border-bottom: none; }
  .match-row:nth-child(even) { background: #0d2013; }
  .match-row:hover { background: #163523; }

  .match-row td {
    padding: 0.8rem 1rem;
    vertical-align: middle;
    line-height: 1.3;
  }

  .col-num      { width: 3.5rem;  color: #6ee7b7; font-family: monospace; font-size: 0.9rem; }
  .col-datetime { width: 10rem;   white-space: nowrap; font-size: 0.95rem; color: #d1fae5; }
  .col-details  { min-width: 14rem; font-size: 1.05rem; font-weight: 600; color: #f0fdf4; }
  .col-score    { width: 6rem;    text-align: center; font-family: monospace; font-size: 1rem; color: #94a3b8; white-space: nowrap; }
  .col-score.score-set { color: #4ade80; font-size: 1.2rem; font-weight: 800; }
  .col-status   { width: 8rem; }
  .col-venue    { width: 8rem;    font-size: 0.9rem; color: #86efac; }
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

  .badge-upcoming { background: #1f2937; color: #9ca3af; }
  .badge-done     { background: #14532d; color: #bbf7d0; }

  .badge-live {
    background: #166534;
    color: #4ade80;
    animation: blink 1.4s ease-in-out infinite;
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.5; }
  }

  .source-tag {
    display: inline-block;
    background: #0f1f14;
    border: 1px solid #1e4025;
    color: #6ee7b7;
    padding: 0.2rem 0.55rem;
    border-radius: 4px;
    font-size: 0.75rem;
    line-height: 1.4;
  }

  /* ── Standings ── */
  .standings-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
    gap: 1.25rem;
  }

  .standings-card {
    background: #0d2013;
    border: 1px solid #1e4025;
    border-radius: 8px;
    overflow: hidden;
  }

  .standings-card-header {
    background: #112a17;
    border-bottom: 1px solid #1e4025;
    padding: 0.6rem 1rem;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
  }

  .standings-competition {
    font-size: 0.85rem;
    font-weight: 700;
    color: #4ade80;
  }

  .standings-pool {
    font-size: 0.75rem;
    color: #6ee7b7;
    background: #1e4025;
    border: 1px solid #2d6a3f;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
  }

  .standings-table-wrap { overflow-x: auto; }

  .standings-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }

  .standings-table thead tr {
    background: #0a1a0f;
    border-bottom: 1px solid #1e4025;
  }

  .standings-table th {
    padding: 0.5rem 0.6rem;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #4ade80;
    white-space: nowrap;
  }

  .st-row {
    border-bottom: 1px solid #142010;
    transition: background 0.1s;
  }
  .st-row:last-child { border-bottom: none; }
  .st-row:hover { background: #163523; }
  .st-top { background: #0f2a18; }
  .st-top:hover { background: #163523; }

  .standings-table td {
    padding: 0.5rem 0.6rem;
    vertical-align: middle;
  }

  .st-rank { width: 2rem; color: #6ee7b7; font-weight: 700; text-align: center; }
  .st-team {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 120px;
    font-weight: 600;
    color: #f0fdf4;
  }
  .st-num { text-align: right; width: 2.5rem; color: #a7f3d0; font-variant-numeric: tabular-nums; }
  .st-pts { text-align: right; width: 2.5rem; font-weight: 800; color: #4ade80; font-variant-numeric: tabular-nums; }
  .st-diff { font-variant-numeric: tabular-nums; }
  .st-diff.pos { color: #4ade80; }
  .st-diff.neg { color: #f87171; }

  .team-flag {
    width: 24px;
    height: 24px;
    object-fit: contain;
    flex-shrink: 0;
    border-radius: 2px;
  }

  /* ── Responsive: TV / large screen ── */
  @media (min-width: 1400px) {
    .title          { font-size: 2.4rem; }
    .match-table    { font-size: 1.15rem; }
    .match-row td   { padding: 1rem 1.25rem; }
    .col-score.score-set { font-size: 1.4rem; }
    .col-details    { font-size: 1.2rem; }
    .standings-grid { grid-template-columns: repeat(auto-fill, minmax(500px, 1fr)); }
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
    .standings-grid { grid-template-columns: 1fr; }
  }
`
