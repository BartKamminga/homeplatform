import { useState, useEffect, useRef, useMemo } from 'react'
import { getTournaments, getHockeyPublications, getClubs, saveBoard, getBoardByCode, searchPools, searchDiscoveryPools, getTournamentCompetitionStandings, getDiscoverySeason } from './api.js'
import { C, SEASON, CLUB_KEY, BOARD_KEY, PINS_KEY, POOL_PINS_KEY, MY_BOARDS_KEY, QUERY_PINS_KEY } from './constants.js'
import { BoardView } from './BoardView.jsx'
import { usePersistedState } from './hooks.js'
import { MyBoardsView } from './MyBoardsView.jsx'
import { SearchView } from './SearchView.jsx'
import { SaveBoardDialog } from './SaveBoardDialog.jsx'
import { BrowseView } from './BrowseView.jsx'

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
  const [pins, setPins, setPinsRaw]           = usePersistedState(PINS_KEY, {
    serialize: s => [...s], deserialize: arr => new Set(arr), initial: () => new Set(),
  })
  const [poolPins, setPoolPins, setPoolPinsRaw] = usePersistedState(POOL_PINS_KEY, {
    serialize: m => [...m.values()],
    deserialize: arr => new Map(arr.map(p => [`${p.phaseId}::${p.poolName}`, p])),
    initial: () => new Map(),
  })
  const [myBoards, setMyBoards]               = useState(() => {
    try { return JSON.parse(localStorage.getItem(MY_BOARDS_KEY) || '[]') }
    catch { return [] }
  })
  const [queryPins, setQueryPins]             = usePersistedState(QUERY_PINS_KEY, {
    serialize: m => [...m.entries()], deserialize: arr => new Map(arr), initial: () => new Map(),
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
      setPinsRaw(new Set(b.pins))
      setPoolPinsRaw(new Map(b.pool_pins.map(p => [`${p.phaseId}::${p.poolName}`, p])))
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
      Promise.all([
        searchPools(searchQ, SEASON).catch(() => []),
        searchDiscoveryPools(searchQ).catch(() => []),
      ]).then(([tournix, discovery]) => setSearchResults([...discovery, ...tournix]))
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
      return next
    })
  }

  function togglePoolPin(phaseId, poolName, tournamentName) {
    const key = `${phaseId}::${poolName}`
    setPoolPins(prev => {
      const next = new Map(prev)
      if (next.has(key)) next.delete(key)
      else next.set(key, { phaseId, poolName, tournamentName })
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

  function openMyBoard(b) {
    setClub(b.club)
    setPins(new Set(b.pins || []))
    setPoolPins(new Map((b.pool_pins || []).map(p => [`${p.phaseId}::${p.poolName}`, p])))
    setBoardOn(true)
    setSharedBoard(null)
    setMyBoardsView(false)
    if (b.club) localStorage.setItem(CLUB_KEY, b.club)
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

      <SaveBoardDialog
        open={saveDialog}
        onClose={() => setSaveDialog(false)}
        saveName={saveName}
        onSaveNameChange={setSaveName}
        saveNameRef={saveNameRef}
        saving={saving}
        savedCode={savedCode}
        onSave={doSaveBoard}
        shareUrl={savedCode ? boardShareUrl(savedCode) : ''}
        onCopyUrl={() => copyUrl(savedCode)}
        copied={copied}
      />

      {/* Body */}
      {myBoardsView ? (
        <MyBoardsView
          myBoards={myBoards}
          onOpen={openMyBoard}
          onCopyUrl={copyUrl}
          onDelete={code => {
            const next = myBoards.filter(x => x.code !== code)
            setMyBoards(next)
            localStorage.setItem(MY_BOARDS_KEY, JSON.stringify(next))
          }}
          onNewBoard={() => { setMyBoardsView(false); setBoardOn(false) }}
        />
      ) : searchMode ? (
        <SearchView
          searchQ={searchQ}
          visible={visible}
          searchResults={searchResults}
          club={club}
          pins={pins}
          poolPins={poolPins}
          onTogglePin={togglePin}
          onTogglePoolPin={togglePoolPin}
        />
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
        <BrowseView
          all={all}
          error={error}
          selectedPub={selectedPub}
          infoOpen={infoOpen}
          onToggleInfo={() => setInfoOpen(o => !o)}
          tagFilter={tagFilter}
          onSetTagFilter={setTagFilter}
          filtersOpen={filtersOpen}
          onToggleFiltersOpen={() => {
            const next = !filtersOpen
            setFiltersOpen(next)
            if (next) localStorage.removeItem('pb_filters')
            else localStorage.setItem('pb_filters', '0')
          }}
          allTags={allTags}
          pubComps={pubComps}
          filteredComps={filteredComps}
          expandedCompId={expandedCompId}
          onToggleComp={id => setExpandedCompId(cur => cur === id ? null : id)}
          club={club}
          poolPins={poolPins}
          onPoolPin={togglePoolPin}
          queryPins={queryPins}
          queryDrafts={queryDrafts}
          onSetQueryPin={setQueryPin}
          onUpdateQueryPin={updateQueryPin}
          onRemoveQueryPin={removeQueryPin}
          onSetQueryDraft={(key, patch) =>
            setQueryDrafts(prev => ({ ...prev, [key]: { ...(prev[key] || {}), ...patch } }))}
        />
      )}
    </div>
  )
}
