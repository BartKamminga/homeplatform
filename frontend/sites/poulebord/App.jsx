import { useState, useEffect, useRef } from 'react'
import { getClubs, saveBoard, getBoardByCode, searchDiscoveryPools } from './api.js'
import { C, CLUB_KEY, BOARD_KEY, MY_BOARDS_KEY } from './constants.js'
import { BoardView } from './PinnedBoard.jsx'
import { usePublicationBrowse, usePoulebordPins } from './hooks.js'
import { Header } from './Header.jsx'
import { MyBoardsView } from './MyBoardsView.jsx'
import { SearchView } from './SearchView.jsx'
import { SaveBoardDialog } from './SaveBoardDialog.jsx'
import { BrowseView } from './BrowseView.jsx'

// ── App ───────────────────────────────────────────────────────────────────────
// item 692: publicatie/tag/navigatie-state zit in usePublicationBrowse en alle
// pin-datasets in usePoulebordPins (beide in hooks.js); de sticky header-JSX
// zit in Header.jsx. App.jsx blijft over met UI-mode-state (welk scherm actief
// is) en de dialogen/effecten die daar direct bij horen.

export default function App() {
  const browse = usePublicationBrowse()
  const { all, error, selectedPub, tagFilters, toggleTagFilter, clearTagFilters,
    pubComps, expandedCompId, setExpandedCompId, allTags, filteredComps, navigateTo } = browse

  const pinsApi = usePoulebordPins()
  const { pins, setPins, setPinsRaw, poolPins, setPoolPins, setPoolPinsRaw, queryPins, filterPins,
    togglePin, togglePoolPin, setQueryPin, updateQueryPin, removeQueryPin,
    filterPinKey, toggleFilterPin, removeFilterPin } = pinsApi

  const [club, setClub]                       = useState(() => localStorage.getItem(CLUB_KEY) || '')
  const [clubEdit, setClubEdit]               = useState(false)
  const [clubs, setClubs]                     = useState([])
  const [infoOpen, setInfoOpen]               = useState(false)
  const [boardOn, setBoardOn]                 = useState(() => localStorage.getItem(BOARD_KEY) === '1')
  const [myBoards, setMyBoards]               = useState(() => {
    try { return JSON.parse(localStorage.getItem(MY_BOARDS_KEY) || '[]') }
    catch { return [] }
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
    if (!searchMode || searchQ.length < 2) { setSearchResults(null); return }
    clearTimeout(searchTimerRef.current)
    // item 684: Tournix-zoektak (searchPools) verwijderd - levert 0 resultaten
    // op in productie (geen gepubliceerde Tournix-toernooien meer).
    searchTimerRef.current = setTimeout(() => {
      searchDiscoveryPools(searchQ).catch(() => []).then(setSearchResults)
    }, 300)
    return () => clearTimeout(searchTimerRef.current)
  }, [searchQ, searchMode])

  function handlePubChange(t) { browse.setSelectedPub(t); setInfoOpen(false) }

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

  // item 676: klik op een zoekresultaat (team/poule) opent de browse-pagina
  // met de bijbehorende publicatie geselecteerd en (indien Hockey Discovery)
  // de competitie uitgeklapt met de bijbehorende tags actief.
  function navigateToSearchResult(result) {
    const pouleId = result.phase_id?.startsWith('disc_')
      ? parseInt(result.phase_id.slice(5), 10)
      : undefined
    if (!navigateTo({ tournamentId: result.tournament_id, pouleId })) return
    closeSearch()
    setBoardOn(false)
    setMyBoardsView(false)
  }

  // item 683: klik op een gepinde filter-snelkoppeling.
  function navigateToFilterPin(pin) {
    if (!navigateTo({ tournamentId: pin.tournamentId, tags: pin.tags })) return
    setBoardOn(false)
    setMyBoardsView(false)
    setSearchMode(false)
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
  const visible = searchMode
    ? (all || []).filter(t => t.name.toLowerCase().includes(searchQ.toLowerCase()))
    : []

  return (
    <div style={{ minHeight: '100dvh', background: C.bg, fontFamily: "'Inter', sans-serif", color: C.chalk }}>

      <Header
        myBoardsView={myBoardsView} setMyBoardsView={setMyBoardsView}
        boardOn={boardOn} setBoardOn={setBoardOn} toggleBoard={toggleBoard}
        searchMode={searchMode} setSearchMode={setSearchMode} openSearch={openSearch} closeSearch={closeSearch}
        searchQ={searchQ} setSearchQ={setSearchQ} searchRef={searchRef}
        myBoards={myBoards} club={club} clubEdit={clubEdit} setClubEdit={setClubEdit}
        clubs={clubs} saveClub={saveClub} totalPins={totalPins}
        all={all} selectedPub={selectedPub} onPubChange={handlePubChange}
      />

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
          onOpenResult={navigateToSearchResult}
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
            filterPins={filterPins}
            onOpenFilterPin={navigateToFilterPin}
            onRemoveFilterPin={removeFilterPin}
          />
        </>
      ) : (
        <BrowseView
          all={all}
          error={error}
          selectedPub={selectedPub}
          infoOpen={infoOpen}
          onToggleInfo={() => setInfoOpen(o => !o)}
          tagFilters={tagFilters}
          onToggleTagFilter={toggleTagFilter}
          onClearTagFilters={clearTagFilters}
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
          filterPinned={!!selectedPub && filterPins.has(filterPinKey(selectedPub.id, tagFilters))}
          onToggleFilterPin={() => toggleFilterPin(selectedPub, tagFilters)}
        />
      )}
    </div>
  )
}
