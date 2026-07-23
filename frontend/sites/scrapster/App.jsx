import { useState, useEffect, useCallback, useRef } from 'react'

// ── Constants ──────────────────────────────────────────────────────────────

const API_URL = '/api/scrapster/matches'
const DEFAULT_REFRESH = 60 // seconds

// ── Helpers ────────────────────────────────────────────────────────────────

function parseDate(str) {
  if (!str) return new Date(0)
  const cleaned = str.trim()
  // dd-mm-yyyy HH:MM  or  dd/mm/yyyy HH:MM
  const dmyMatch = cleaned.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})\s+(\d{2}):(\d{2})/)
  if (dmyMatch) {
    const [, d, m, y, hh, mm] = dmyMatch
    return new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm))
  }
  // "2026-07-23 09:00:00" → safe ISO parse (space → T)
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
  }
}

function writeFiltersToUrl(venues, sources, pastFilter) {
  const p = new URLSearchParams()
  venues.forEach(v => p.append('venue', v))
  sources.forEach(s => p.append('source', s))
  if (pastFilter && pastFilter !== 'laatste3') p.set('past', pastFilter)
  const qs = p.toString()
  history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
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
  // Live: "4th Quarter 55'", "Half Time", "2nd Half", "Penalty Shootout", etc.
  if (
    s.includes('live') || s.includes('progress') || s.includes('bezig') || s.includes('playing') ||
    s.includes('quarter') || s.includes('half') || s.includes('period') || s.includes('penalty') ||
    /\d+['']/.test(s)  // e.g. "55'"
  ) {
    return { label: status, cls: 'badge-live' }
  }
  if (
    s.includes('finish') ||
    s.includes('played') ||
    s.includes('gespeeld') ||
    s.includes('result') ||
    s.includes('full') ||
    s.includes('complete')
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
  const [selectedVenues, setSelectedVenues] = useState(initFilters.venues)
  const [selectedSources, setSelectedSources] = useState(initFilters.sources)
  const [pastFilter, setPastFilter] = useState(initFilters.pastFilter)
  const [copied, setCopied] = useState(false)

  const [refreshInterval, setRefreshInterval] = useState(DEFAULT_REFRESH)
  const [countdown, setCountdown] = useState(DEFAULT_REFRESH)

  const countdownRef = useRef(countdown)
  const refreshIntervalRef = useRef(refreshInterval)

  // Keep refs in sync
  useEffect(() => { refreshIntervalRef.current = refreshInterval }, [refreshInterval])

  const fetchMatches = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch(API_URL)
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

  // Initial fetch
  useEffect(() => {
    fetchMatches()
  }, [fetchMatches])

  // Countdown tick + auto-refresh
  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          fetchMatches()
          return refreshIntervalRef.current
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(tick)
  }, [fetchMatches])

  // Sync filters to URL
  useEffect(() => {
    writeFiltersToUrl(selectedVenues, selectedSources, pastFilter)
  }, [selectedVenues, selectedSources, pastFilter])

  function copyUrl() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // Unique filter options derived from data
  const allVenues = [...new Set(matches.map(m => m.venue).filter(Boolean))].sort()
  const allSources = [...new Set(matches.map(m => m.source).filter(Boolean))].sort()

  function toggleVenue(v) {
    setSelectedVenues(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])
  }
  function toggleSource(s) {
    setSelectedSources(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  // Filter + sort
  const filtered = applyPastFilter(
    matches
      .filter(m => selectedVenues.length === 0 || selectedVenues.includes(m.venue))
      .filter(m => selectedSources.length === 0 || selectedSources.includes(m.source)),
    pastFilter
  ).sort((a, b) => parseDate(a.datetime_str) - parseDate(b.datetime_str))

  const now = new Date()
  const timeStr = lastFetched
    ? lastFetched.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—'

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
              {!loading && !error && <span className="pill pill-ok">{filtered.length} wedstrijden</span>}
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

        {/* ── Filters ── */}
        {(allVenues.length > 0 || allSources.length > 0) && (
          <section className="filters">
            {allSources.length > 0 && (
              <ChipGroup
                label="Toernooi:"
                options={allSources}
                selected={selectedSources}
                onToggle={toggleSource}
              />
            )}
            {allVenues.length > 0 && (
              <ChipGroup
                label="Veld:"
                options={allVenues}
                selected={selectedVenues}
                onToggle={toggleVenue}
              />
            )}
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
            {(selectedVenues.length > 0 || selectedSources.length > 0) && (
              <button
                className="btn-clear"
                onClick={() => { setSelectedVenues([]); setSelectedSources([]) }}
              >
                Filters wissen
              </button>
            )}
            <button className="btn-copy-url" onClick={copyUrl}>
              {copied ? '✓ Gekopieerd!' : '🔗 Kopieer link'}
            </button>
          </section>
        )}

        {/* ── Match table ── */}
        <main className="main">
          {loading && matches.length === 0 ? (
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
          )}
        </main>

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

  /* Column widths */
  .col-num      { width: 3.5rem;  color: #6ee7b7; font-family: monospace; font-size: 0.9rem; }
  .col-datetime { width: 10rem;   white-space: nowrap; font-size: 0.95rem; color: #d1fae5; }
  .col-details  { min-width: 14rem; font-size: 1.05rem; font-weight: 600; color: #f0fdf4; }
  .col-score    { width: 6rem;    text-align: center; font-family: monospace; font-size: 1rem; color: #94a3b8; white-space: nowrap; }
  .col-score.score-set { color: #4ade80; font-size: 1.2rem; font-weight: 800; }
  .col-status   { width: 8rem;   }
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

  /* ── Source tag ── */
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

  /* ── Responsive: TV / large screen ── */
  @media (min-width: 1400px) {
    .title          { font-size: 2.4rem; }
    .match-table    { font-size: 1.15rem; }
    .match-row td   { padding: 1rem 1.25rem; }
    .col-score.score-set { font-size: 1.4rem; }
    .col-details    { font-size: 1.2rem; }
  }

  /* ── Responsive: narrow ── */
  @media (max-width: 700px) {
    .header { flex-direction: column; }
    .header-right { align-items: flex-start; width: 100%; }
    .filters { padding: 0.5rem 1rem; }
    .main { padding: 0.5rem; }
    .col-source, .col-num { display: none; }
  }
`
