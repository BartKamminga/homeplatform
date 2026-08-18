import { useState, useEffect, useRef, useMemo } from 'react'
import { getTournaments, getHockeyPublications, getClubs, saveBoard, getBoardByCode, searchPools, getTournamentCompetitionStandings, getDiscoverySeason } from './api.js'
import { C, SEASON, CLUB_KEY, BOARD_KEY, PINS_KEY, POOL_PINS_KEY, MY_BOARDS_KEY, QUERY_PINS_KEY, categoryOf } from './constants.js'
import { BoardView, SeizoenInfo, TournamentCard } from './BoardView.jsx'
import { PoolSearchCard, CompBrowseItem } from './BrowseComponents.jsx'
import { QueryCard } from './QueryCard.jsx'

const QUERY_SLOTS = [
  { template: 'ranking',        stat: 'points' },
  { template: 'round_scorers',  stat: 'goals_for' },
  { template: 'round_scorers',  stat: 'goals_against' },
  { template: 'round_matches',  stat: 'biggest_margin' },
  { template: 'round_matches',  stat: 'closest_match' },
]

// ── Club dropdown (item 551) ──────────────────────────────────────────────────

function ClubDropdown({ value, clubs, onSelect, onSave, C }) {
  const [input,     setInput]     = useState(value)
  const [open,      setOpen]      = useState(true)
  const [highlight, setHighlight] = useState(0)

  const filtered = useMemo(() => {
    const q = input.trim().toLowerCase()
    if (!q) return clubs.slice(0, 12)
    return clubs.filter(c => c.toLowerCase().startsWith(q)).slice(0, 12)
  }, [input, clubs])

  function select(c) { setInput(c); setOpen(false); onSelect(c) }

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') { setHighlight(h => Math.min(h + 1, filtered.length - 1)); e.preventDefault() }
    if (e.key === 'ArrowUp')   { setHighlight(h => Math.max(h - 1, 0)); e.preventDefault() }
    if (e.key === 'Enter')     { if (open && filtered[highlight]) select(filtered[highlight]); else onSave(input); e.preventDefault() }
    if (e.key === 'Escape')    setOpen(false)
  }

  return (
    <div style={{ flex: 1, position: 'relative' }}>
      <input
        value={input}
        onChange={e => { setInput(e.target.value); setHighlight(0); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={handleKeyDown}
        placeholder="Clubnaam (bijv. Kampong)"
        autoFocus
        style={{
          width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6,
          color: C.chalk, fontSize: 12, padding: '5px 10px', fontFamily: 'inherit',
          outline: 'none', boxSizing: 'border-box',
        }}
      />
      {open && filtered.length > 0 && (
        <div style={{ position: 'absolute', top: 'calc(100% + 3px)', left: 0, right: 0,
          background: C.deep, border: `1px solid ${C.border}`, borderRadius: 6,
          zIndex: 50, maxHeight: 200, overflowY: 'auto' }}>
          {filtered.map((c, i) => (
            <div
              key={c}
              onMouseDown={e => { e.preventDefault(); select(c) }}
              style={{
                padding: '7px 10px', cursor: 'pointer', fontSize: 12,
                color: i === highlight ? C.gold : C.chalk,
                background: i === highlight ? 'rgba(207,159,63,0.1)' : 'transparent',
                borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : 'none',
              }}
            >{c}</div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [season, setSeason]                    = useState(SEASON)
  const [allRaw, setAllRaw]                   = useState(null)
  const all = useMemo(() => {
    if (allRaw === null) return null
    const norm = s => (s || '').replace(/\s*-\s*/g, '-')
    return allRaw.filter(t => norm(t.season) === norm(season))
  }, [allRaw, season])

  const [selectedPub, setSelectedPub]         = useState(null)
  const [tagFilter, setTagFilter]             = useState(null)
  const [pubComps, setPubComps]               = useState(null)
  const [expandedCompId, setExpandedCompId]   = useState(null)
  const [club, setClub]                       = useState(() => localStorage.getItem(CLUB_KEY) || '')
  const [clubEdit, setClubEdit]               = useState(false)
  const [clubs, setClubs]                     = useState([])
  const [infoOpen, setInfoOpen]               = useState(false)
  const [error, setError]                     = useState(null)
  const [boardOn, setBoardOn]                 = useState(() => localStorage.getItem(BOARD_KEY) === '1')
  const [pins, setPins]                       = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(PINS_KEY) || '[]')) }
    catch { return new Set() }
  })
  const [poolPins, setPoolPins]               = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(POOL_PINS_KEY) || '[]')
      return new Map(raw.map(p => [`${p.phaseId}::${p.poolName}`, p]))
    } catch { return new Map() }
  })
  const [myBoards, setMyBoards]               = useState(() => {
    try { return JSON.parse(localStorage.getItem(MY_BOARDS_KEY) || '[]') }
    catch { return [] }
  })
  const [queryPins, setQueryPins]             = useState(() => {
    try { return new Map(JSON.parse(localStorage.getItem(QUERY_PINS_KEY) || '[]')) }
    catch { return new Map() }
  })
  const [queryDrafts, setQueryDrafts]         = useState({})
  const [myBoardsView, setMyBoardsView]       = useState(false)
  const [searchMode, setSearchMode]           = useState(false)
  const [searchQ, setSearchQ]                 = useState('')
  const searchRef                             = useRef(null)
  const [searchResults, setSearchResults]     = useState(null)
  const searchTimerRef                        = useRef(null)
  const [sharedBoard, setSharedBoard]         = useState(null)
  const [filtersOpen, setFiltersOpen]         = useState(() => localStorage.getItem('pb_filters') !== '0')
  const [saveDialog, setSaveDialog]           = useState(false)
  const [saveName, setSaveName]               = useState('')
  const [saving, setSaving]                   = useState(false)
  const [savedCode, setSavedCode]             = useState(null)
  const [copied, setCopied]                   = useState(false)
  const saveNameRef                           = useRef(null)

  useEffect(() => {
    fetch('/api/tournix/public/beacon', { method: 'POST' }).catch(() => {})
  }, [])

  useEffect(() => {
    getDiscoverySeason().then(r => { if (r.season) setSeason(r.season) }).catch(() => {})
  }, [])

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('b')
    if (!code) return
    getBoardByCode(code).then(b => {
      setClub(b.club)
      setPins(new Set(b.pins))
      setPoolPins(new Map(b.pool_pins.map(p => [`${p.phaseId}::${p.poolName}`, p])))
      setBoardOn(true)
      setSharedBoard({ id: b.id, name: b.name })
    }).catch(() => {})
  }, [])

  useEffect(() => { getClubs().then(setClubs).catch(() => {}) }, [])

  useEffect(() => {
    Promise.all([
      getTournaments().catch(() => []),
      getHockeyPublications().catch(() => []),
    ]).then(([tournix, hockey]) => {
      setAllRaw([...hockey, ...tournix])
    }).catch(() => setError('Kon publicaties niet laden'))
  }, [])

  useEffect(() => {
    if (!all) return
    if (!all.find(t => t.id === selectedPub?.id)) setSelectedPub(all[0] || null)
  }, [all])

  useEffect(() => {
    if (!selectedPub) { setPubComps(null); return }
    setPubComps(null)
    setTagFilter(null)
    setExpandedCompId(null)
    getTournamentCompetitionStandings(selectedPub.id)
      .then(data => setPubComps(data.competitions || []))
      .catch(() => setPubComps([]))
  }, [selectedPub])

  useEffect(() => {
    if (!searchMode || searchQ.length < 2) { setSearchResults(null); return }
    clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      searchPools(searchQ, SEASON).then(setSearchResults).catch(() => setSearchResults([]))
    }, 300)
    return () => clearTimeout(searchTimerRef.current)
  }, [searchQ, searchMode])

  function handlePubChange(t) { setSelectedPub(t); setInfoOpen(false) }

  function saveClub(val) {
    const v = (val ?? '').trim()
    setClub(v)
    if (v) localStorage.setItem(CLUB_KEY, v)
    else localStorage.removeItem(CLUB_KEY)
    setClubEdit(false)
  }

  function toggleBoard() {
    const next = !boardOn
    setBoardOn(next)
    setMyBoardsView(false)
    setSearchMode(false)
    if (next) localStorage.setItem(BOARD_KEY, '1')
    else localStorage.removeItem(BOARD_KEY)
  }

  function openSearch() {
    setSearchMode(true)
    setSearchQ('')
    setBoardOn(false)
    setMyBoardsView(false)
    setTimeout(() => searchRef.current?.focus(), 50)
  }

  function closeSearch() {
    setSearchMode(false)
    setSearchQ('')
    setSearchResults(null)
  }

  function togglePin(tid) {
    setPins(prev => {
      const next = new Set(prev)
      if (next.has(tid)) next.delete(tid)
      else next.add(tid)
      localStorage.setItem(PINS_KEY, JSON.stringify([...next]))
      return next
    })
  }

  function togglePoolPin(phaseId, poolName, tournamentName) {
    const key = `${phaseId}::${poolName}`
    setPoolPins(prev => {
      const next = new Map(prev)
      if (next.has(key)) next.delete(key)
      else next.set(key, { phaseId, poolName, tournamentName })
      localStorage.setItem(POOL_PINS_KEY, JSON.stringify([...next.values()]))
      return next
    })
  }

  function setQueryPin(key, cfg) {
    setQueryPins(prev => {
      const next = new Map(prev)
      next.set(key, cfg)
      localStorage.setItem(QUERY_PINS_KEY, JSON.stringify([...next.entries()]))
      return next
    })
  }

  function updateQueryPin(key, patch) {
    setQueryPins(prev => {
      const cur = prev.get(key)
      if (!cur) return prev
      const next = new Map(prev)
      next.set(key, { ...cur, ...patch })
      localStorage.setItem(QUERY_PINS_KEY, JSON.stringify([...next.entries()]))
      return next
    })
  }

  function removeQueryPin(key) {
    setQueryPins(prev => {
      const next = new Map(prev)
      next.delete(key)
      localStorage.setItem(QUERY_PINS_KEY, JSON.stringify([...next.entries()]))
      return next
    })
  }

  function openMyBoard(b) {
    setClub(b.club)
    setPins(new Set(b.pins || []))
    setPoolPins(new Map((b.pool_pins || []).map(p => [`${p.phaseId}::${p.poolName}`, p])))
    setBoardOn(true)
    setSharedBoard(null)
    setMyBoardsView(false)
    if (b.club) localStorage.setItem(CLUB_KEY, b.club)
    localStorage.setItem(PINS_KEY, JSON.stringify(b.pins || []))
    localStorage.setItem(POOL_PINS_KEY, JSON.stringify(b.pool_pins || []))
    localStorage.setItem(BOARD_KEY, '1')
  }

  async function doSaveBoard() {
    if (!saveName.trim()) return
    setSaving(true)
    try {
      const b = await saveBoard({
        name: saveName.trim(),
        club,
        pins: [...pins],
        pool_pins: [...poolPins.values()],
      })
      const entry = { code: b.id, name: b.name, club: b.club,
        pins: b.pins, pool_pins: b.pool_pins, savedAt: new Date().toISOString() }
      const next = [entry, ...myBoards.filter(x => x.code !== b.id)]
      setMyBoards(next)
      localStorage.setItem(MY_BOARDS_KEY, JSON.stringify(next))
      setSavedCode(b.id)
    } catch {
      alert('Opslaan mislukt')
    } finally {
      setSaving(false)
    }
  }

  function boardShareUrl(code) {
    return `${window.location.origin}${window.location.pathname}?b=${code}`
  }

  function copyUrl(code) {
    navigator.clipboard.writeText(boardShareUrl(code)).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const totalPins = pins.size + poolPins.size
  const allTags   = pubComps
    ? [...new Set(pubComps.flatMap(c => (c.fase_tags || []).map(t => t.name)))]
    : []
  const filteredComps = !pubComps ? [] : !tagFilter ? pubComps
    : pubComps.filter(c => (c.fase_tags || []).some(t => t.name === tagFilter))
  const visible = searchMode
    ? (all || []).filter(t => t.name.toLowerCase().includes(searchQ.toLowerCase()))
    : []

  return (
    <div style={{ minHeight: '100dvh', background: C.bg, fontFamily: "'Inter', sans-serif", color: C.chalk }}>

      {/* Sticky header */}
      <div style={{ background: C.deep, position: 'sticky', top: 0, zIndex: 10,
        borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 12px 8px' }}>
          <button onClick={() => { setMyBoardsView(false); setBoardOn(false) }} style={{
            background: 'transparent', border: 'none', padding: '0 4px 0 0', cursor: 'pointer',
          }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: '0.06em',
              color: C.chalk, lineHeight: 1 }}>🏒</div>
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: '0.06em',
              color: C.chalk, lineHeight: 1 }}>POULEBORD</div>
            <div style={{ fontSize: 9, color: C.muted, letterSpacing: '0.05em' }}>SEIZOEN {SEASON}</div>
          </div>
          <button onClick={searchMode ? closeSearch : openSearch} style={{
            background: searchMode ? 'rgba(207,159,63,0.15)' : 'transparent',
            border: `1px solid ${searchMode ? C.gold : C.border}`,
            borderRadius: 16, padding: '4px 9px', cursor: 'pointer',
            color: searchMode ? C.gold : C.muted, fontSize: 11, whiteSpace: 'nowrap', fontFamily: 'inherit',
          }}>🔍</button>
          {myBoards.length > 0 && (
            <button onClick={() => { setMyBoardsView(v => !v); setBoardOn(false); setSearchMode(false) }} style={{
              background: myBoardsView ? 'rgba(207,159,63,0.15)' : 'transparent',
              border: `1px solid ${myBoardsView ? C.gold : C.border}`,
              borderRadius: 16, padding: '4px 9px', cursor: 'pointer',
              color: myBoardsView ? C.gold : C.muted, fontSize: 10, whiteSpace: 'nowrap', fontFamily: 'inherit',
            }}>⊞ {myBoards.length}</button>
          )}
          <button onClick={() => setClubEdit(e => !e)} style={{
            background: club ? 'rgba(207,159,63,0.15)' : 'transparent',
            border: `1px solid ${club ? C.gold : C.border}`,
            borderRadius: 16, padding: '4px 9px', cursor: 'pointer',
            color: club ? C.gold : C.muted, fontSize: 10, whiteSpace: 'nowrap', fontFamily: 'inherit',
          }}>
            {club ? `⭐ ${club}` : '⭐ Club'}
          </button>
          <button onClick={toggleBoard} title={boardOn ? 'Terug naar browse' : 'Mijn board'} style={{
            background: boardOn ? C.gold : (totalPins > 0 ? 'rgba(207,159,63,0.1)' : 'transparent'),
            border: `1px solid ${boardOn ? C.gold : (totalPins > 0 ? C.gold : C.border)}`,
            borderRadius: 16, padding: '4px 9px', cursor: 'pointer',
            color: boardOn ? C.deep : (totalPins > 0 ? C.gold : C.muted),
            fontSize: 10, whiteSpace: 'nowrap', fontFamily: 'inherit', fontWeight: boardOn ? 700 : 400,
          }}>
            📌{!boardOn && totalPins > 0 ? ` ${totalPins}` : ''}
          </button>
        </div>

        {/* Club edit row (item 551: custom dropdown) */}
        {clubEdit && (
          <div style={{ padding: '8px 12px', display: 'flex', gap: 6, alignItems: 'flex-start',
            borderTop: `1px solid ${C.border}` }}>
            <ClubDropdown
              value={club}
              clubs={clubs}
              onSelect={c => saveClub(c)}
              onSave={saveClub}
              C={C}
            />
            <button onClick={() => saveClub(club)} style={{
              background: C.gold, color: C.deep, border: 'none', borderRadius: 6,
              padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'inherit', flexShrink: 0,
            }}>OK</button>
            {club && (
              <button onClick={() => { setClub(''); localStorage.removeItem(CLUB_KEY); setClubEdit(false) }} style={{
                background: 'transparent', color: C.muted, border: `1px solid ${C.border}`,
                borderRadius: 6, padding: '5px 8px', fontSize: 11, cursor: 'pointer',
                fontFamily: 'inherit', flexShrink: 0,
              }}>✕</button>
            )}
          </div>
        )}

        {/* Search bar */}
        {searchMode && (
          <div style={{ padding: '6px 12px 10px', borderTop: `1px solid ${C.border}` }}>
            <input
              ref={searchRef}
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder="Zoek competitie, team of poule…"
              style={{
                width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
                color: C.chalk, fontSize: 13, padding: '7px 12px', fontFamily: 'inherit',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
        )}

        {/* Publication tabs */}
        {!boardOn && !myBoardsView && !searchMode && all !== null && all.length > 0 && (
          <div style={{ display: 'flex', overflowX: 'auto', padding: '0 8px',
            borderTop: `1px solid ${C.border}`, gap: 2 }}>
            {all.map(t => (
              <button
                key={t.id}
                onClick={() => handlePubChange(t)}
                style={{
                  padding: '8px 12px', fontSize: 12, fontFamily: 'inherit',
                  background: 'transparent', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                  color: selectedPub?.id === t.id ? C.gold : C.muted,
                  fontWeight: selectedPub?.id === t.id ? 700 : 400,
                  borderBottom: selectedPub?.id === t.id ? `2px solid ${C.gold}` : '2px solid transparent',
                }}
              >{t.name}</button>
            ))}
          </div>
        )}
      </div>

      {/* Save dialog overlay */}
      {saveDialog && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}
          onClick={e => e.target === e.currentTarget && setSaveDialog(false)}>
          <div style={{ background: C.deep, borderRadius: 16, padding: '20px 20px 24px',
            width: '100%', maxWidth: 360, border: `1px solid ${C.border}` }}>
            {!savedCode ? (
              <>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20,
                  letterSpacing: '0.06em', marginBottom: 6 }}>Board opslaan & delen</div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>
                  Geef je board een naam en deel de link.
                </div>
                <input
                  ref={saveNameRef}
                  autoFocus
                  value={saveName}
                  onChange={e => setSaveName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && doSaveBoard()}
                  placeholder="Naam voor dit board…"
                  style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`,
                    borderRadius: 8, color: C.chalk, fontSize: 13, padding: '8px 12px',
                    fontFamily: 'inherit', marginBottom: 16, boxSizing: 'border-box', outline: 'none' }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={doSaveBoard} disabled={saving || !saveName.trim()} style={{
                    flex: 1, background: C.gold, color: C.deep, border: 'none', borderRadius: 8,
                    padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                    opacity: saving || !saveName.trim() ? 0.5 : 1,
                  }}>{saving ? 'Opslaan…' : 'Opslaan'}</button>
                  <button onClick={() => { setSaveDialog(false); setSaveName('') }} style={{
                    background: 'transparent', color: C.muted, border: `1px solid ${C.border}`,
                    borderRadius: 8, padding: '10px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                  }}>Annuleer</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20,
                  letterSpacing: '0.06em', marginBottom: 6 }}>Opgeslagen!</div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>
                  Deel de link met iedereen die dit board wil zien.
                </div>
                <div style={{ background: C.bg, borderRadius: 8, padding: '8px 12px', fontSize: 11,
                  color: C.muted, marginBottom: 12, wordBreak: 'break-all', border: `1px solid ${C.border}` }}>
                  {boardShareUrl(savedCode)}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => copyUrl(savedCode)} style={{
                    flex: 1, background: copied ? C.gold : C.card, color: copied ? C.deep : C.chalk,
                    border: `1px solid ${copied ? C.gold : C.border}`, borderRadius: 8,
                    padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  }}>{copied ? 'Gekopieerd!' : '🔗 Kopieer link'}</button>
                  <button onClick={() => { setSaveDialog(false); setSavedCode(null); setSaveName('') }} style={{
                    background: 'transparent', color: C.muted, border: `1px solid ${C.border}`,
                    borderRadius: 8, padding: '10px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                  }}>Sluiten</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Body */}
      {myBoardsView ? (
        <div style={{ padding: '16px 12px' }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: '0.06em',
            marginBottom: 14, color: C.chalk }}>MIJN BOARDS</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {myBoards.map(b => (
              <div key={b.code} style={{ flex: '1 1 240px', background: C.card, borderRadius: 12,
                border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                <div style={{ padding: '14px 14px 10px' }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: C.chalk, marginBottom: 6,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {b.club && (
                      <span style={{ fontSize: 10, color: C.gold, background: 'rgba(207,159,63,0.1)',
                        border: `1px solid ${C.gold}`, borderRadius: 4, padding: '1px 6px' }}>
                        ⭐ {b.club}
                      </span>
                    )}
                    {(b.pins || []).length > 0 && (
                      <span style={{ fontSize: 10, color: C.muted, background: C.deep,
                        border: `1px solid ${C.border}`, borderRadius: 4, padding: '1px 6px' }}>
                        📌 {b.pins.length} comp.
                      </span>
                    )}
                    {(b.pool_pins || []).length > 0 && (
                      <span style={{ fontSize: 10, color: C.muted, background: C.deep,
                        border: `1px solid ${C.border}`, borderRadius: 4, padding: '1px 6px' }}>
                        📌 {b.pool_pins.length} poule{b.pool_pins.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', borderTop: `1px solid ${C.border}` }}>
                  <button onClick={() => openMyBoard(b)} style={{
                    flex: 1, padding: '9px', background: 'transparent', border: 'none',
                    color: C.gold, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                  }}>Openen</button>
                  <button onClick={() => copyUrl(b.code)} style={{
                    padding: '9px 12px', background: 'transparent', border: 'none',
                    borderLeft: `1px solid ${C.border}`,
                    color: C.muted, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                  }}>🔗</button>
                  <button onClick={() => {
                    const next = myBoards.filter(x => x.code !== b.code)
                    setMyBoards(next)
                    localStorage.setItem(MY_BOARDS_KEY, JSON.stringify(next))
                  }} style={{
                    padding: '9px 10px', background: 'transparent', border: 'none',
                    borderLeft: `1px solid ${C.border}`,
                    color: C.muted, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                  }}>✕</button>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => { setMyBoardsView(false); setBoardOn(false) }} style={{
            marginTop: 16, background: 'transparent', border: `1px solid ${C.border}`,
            borderRadius: 8, padding: '8px 16px', color: C.muted, fontSize: 12,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>+ Nieuw board (leeg beginnen)</button>
        </div>
      ) : searchMode ? (
        <div style={{ padding: '10px 10px' }}>
          {searchQ.length < 2 ? (
            <div style={{ textAlign: 'center', color: C.muted, padding: '32px 0', fontSize: 13 }}>
              Typ minimaal 2 tekens om te zoeken…
            </div>
          ) : (
            <>
              {visible.length === 0 && (searchResults === null || searchResults.length === 0) && (
                <div style={{ textAlign: 'center', color: C.muted, padding: '32px 0', fontSize: 13 }}>
                  Niets gevonden voor <strong style={{ color: C.chalk }}>{searchQ}</strong>
                </div>
              )}
              {visible.length > 0 && (
                <>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 8, letterSpacing: '0.05em' }}>
                    Competities ({visible.length})
                  </div>
                  {visible.map(t => (
                    <TournamentCard
                      key={t.id} tournament={t} club={club}
                      pinned={pins.has(t.id)} onPin={() => togglePin(t.id)}
                      poolPins={poolPins}
                      onPoolPin={(phaseId, poolName) => togglePoolPin(phaseId, poolName, t.name)}
                    />
                  ))}
                </>
              )}
              {searchResults !== null && searchResults.length > 0 && (
                <>
                  <div style={{ fontSize: 10, color: C.muted,
                    margin: visible.length > 0 ? '14px 0 8px' : '0 0 8px',
                    letterSpacing: '0.05em' }}>
                    Teams &amp; poules ({searchResults.length})
                  </div>
                  {searchResults.map(r => (
                    <PoolSearchCard
                      key={`${r.phase_id}::${r.pool_name}`}
                      result={r}
                      poolPins={poolPins}
                      onPoolPin={(phaseId, poolName, tn) => togglePoolPin(phaseId, poolName, tn)}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </div>
      ) : boardOn ? (
        <>
          {sharedBoard && (
            <div style={{ background: 'rgba(207,159,63,0.08)', borderBottom: `1px solid ${C.border}`,
              padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, color: C.gold, flex: 1 }}>
                📌 Gedeeld board: <strong>{sharedBoard.name}</strong>
              </span>
              <button onClick={() => {
                setSaveName(sharedBoard.name)
                setSaveDialog(true)
              }} style={{
                background: 'transparent', border: `1px solid ${C.gold}`, borderRadius: 6,
                padding: '3px 10px', fontSize: 10, color: C.gold, cursor: 'pointer', fontFamily: 'inherit',
              }}>Opslaan als mijn board</button>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 12px 0' }}>
            <button onClick={() => { setSaveName(''); setSavedCode(null); setSaveDialog(true) }} style={{
              background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 16,
              padding: '4px 12px', fontSize: 10, color: C.muted, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>💾 Opslaan &amp; delen</button>
          </div>
          <BoardView
            club={club} pins={pins} poolPins={poolPins}
            allTournaments={all}
            onUnpin={togglePin}
            onPoolUnpin={(phaseId, poolName) => togglePoolPin(phaseId, poolName)}
            queryPins={queryPins}
            onQueryUpdate={updateQueryPin}
            onQueryUnpin={removeQueryPin}
          />
        </>
      ) : (
        <div style={{ padding: '12px 10px' }}>
          {error && (
            <div style={{ background: '#3a1010', border: '1px solid #7a2020', borderRadius: 10,
              padding: '12px 16px', color: '#f88', fontSize: 13, margin: '8px 0' }}>
              {error}
            </div>
          )}
          {all === null && !error && (
            <div style={{ textAlign: 'center', color: C.muted, padding: 40, fontSize: 14 }}>Laden…</div>
          )}
          {all !== null && all.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>🏒</div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22,
                letterSpacing: '0.06em', marginBottom: 10 }}>NOG GEEN TOERNOOIEN</div>
              <div style={{ color: C.muted, fontSize: 13, lineHeight: 1.7 }}>
                Maak toernooien aan in Tournix<br />
                met seizoen <span style={{ color: C.gold, fontWeight: 600 }}>{SEASON}</span>
              </div>
            </div>
          )}
          {selectedPub && all !== null && (
            <>
              <SeizoenInfo cat={categoryOf(selectedPub.name)} open={infoOpen} onToggle={() => setInfoOpen(o => !o)} />
              {allTags.length > 0 && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: filtersOpen ? 6 : 12 }}>
                    <button
                      onClick={() => {
                        const next = !filtersOpen
                        setFiltersOpen(next)
                        if (next) localStorage.removeItem('pb_filters')
                        else localStorage.setItem('pb_filters', '0')
                      }}
                      style={{
                        padding: '3px 10px', borderRadius: 12, fontSize: 10, cursor: 'pointer', fontFamily: 'inherit',
                        background: 'transparent', color: tagFilter ? C.gold : C.muted,
                        border: `1px solid ${tagFilter ? C.gold : C.border}`,
                      }}
                    >
                      {filtersOpen ? '▲ Filter' : `▼ Filter${tagFilter ? ` · ${tagFilter}` : ''}`}
                    </button>
                    {!filtersOpen && tagFilter && (
                      <button onClick={() => setTagFilter(null)} style={{
                        padding: '3px 8px', borderRadius: 12, fontSize: 10, cursor: 'pointer', fontFamily: 'inherit',
                        background: 'transparent', color: C.muted, border: `1px solid ${C.border}`,
                      }}>✕</button>
                    )}
                  </div>
                  {filtersOpen && (
                    <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                      <button onClick={() => setTagFilter(null)} style={{
                        padding: '4px 12px', borderRadius: 16, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                        background: !tagFilter ? C.gold : 'transparent', color: !tagFilter ? C.deep : C.muted,
                        border: `1px solid ${!tagFilter ? C.gold : C.border}`, fontWeight: !tagFilter ? 700 : 400,
                      }}>Alle</button>
                      {allTags.map(tag => (
                        <button key={tag} onClick={() => setTagFilter(tagFilter === tag ? null : tag)} style={{
                          padding: '4px 12px', borderRadius: 16, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                          background: tagFilter === tag ? C.gold : 'transparent', color: tagFilter === tag ? C.deep : C.muted,
                          border: `1px solid ${tagFilter === tag ? C.gold : C.border}`, fontWeight: tagFilter === tag ? 700 : 400,
                        }}>{tag}</button>
                      ))}
                    </div>
                  )}
                </>
              )}
              {pubComps === null ? (
                <div style={{ textAlign: 'center', color: C.muted, padding: 40, fontSize: 14 }}>Laden…</div>
              ) : filteredComps.length === 0 ? (
                <div style={{ textAlign: 'center', color: C.muted, padding: '24px 0', fontStyle: 'italic', fontSize: 13 }}>
                  Geen competities{tagFilter ? ` voor "${tagFilter}"` : ''}
                </div>
              ) : (
                filteredComps.map(comp => (
                  <CompBrowseItem
                    key={comp.link_id}
                    comp={comp}
                    club={club}
                    expanded={expandedCompId === comp.link_id}
                    onToggle={() => setExpandedCompId(id => id === comp.link_id ? null : comp.link_id)}
                    poolPins={poolPins}
                    onPoolPin={(phaseId, poolName) => togglePoolPin(phaseId, poolName, selectedPub?.name)}
                  />
                ))
              )}
              {pubComps !== null && pubComps.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
                    color: C.muted, padding: '4px 2px 8px', borderTop: `1px solid ${C.border}` }}>
                    Queries{tagFilter ? ` · ${tagFilter}` : ''}
                  </div>
                  {QUERY_SLOTS.map(({ template, stat }) => {
                    const key = `${selectedPub.id}::${tagFilter || ''}::${template}::${stat}`
                    const pinnedPin = queryPins.get(key)
                    const pin = pinnedPin || {
                      tournamentId: selectedPub.id, tournamentName: selectedPub.name,
                      tag: tagFilter || null, template, stat, scope: 'round', limit: 3,
                      ...(queryDrafts[key] || {}),
                    }
                    return (
                      <QueryCard
                        key={key}
                        pin={pin}
                        pinned={!!pinnedPin}
                        onTogglePin={() => pinnedPin ? removeQueryPin(key) : setQueryPin(key, pin)}
                        onUpdate={patch => pinnedPin
                          ? updateQueryPin(key, patch)
                          : setQueryDrafts(prev => ({ ...prev, [key]: { ...(prev[key] || {}), ...patch } }))}
                      />
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
