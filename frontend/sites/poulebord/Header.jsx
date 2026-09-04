import { useState, useMemo } from 'react'
import { C, SEASON } from './constants.js'

// item 692: sticky header (logo/zoek/mijn-boards/club/board-toggle + club-edit-
// rij + zoekbalk + publicatietabs) uit App.jsx getrokken - pure presentatie,
// geen eigen state buiten de club-dropdown zelf.

// ── Club dropdown (item 551) ──────────────────────────────────────────────────

function ClubDropdown({ value, clubs, onSelect, onSave }) {
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

// ── Header ─────────────────────────────────────────────────────────────────────

export function Header({
  myBoardsView, setMyBoardsView, boardOn, setBoardOn, toggleBoard,
  searchMode, setSearchMode, openSearch, closeSearch, searchQ, setSearchQ, searchRef,
  myBoards, club, clubEdit, setClubEdit, clubs, saveClub, totalPins,
  all, selectedPub, onPubChange, onOpenLive,
}) {
  return (
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
        {selectedPub && (
          <button onClick={onOpenLive} title="Live wedstrijden" style={{
            background: 'transparent', border: `1px solid ${C.border}`,
            borderRadius: 16, padding: '4px 9px', cursor: 'pointer',
            color: '#e5484d', fontSize: 11, whiteSpace: 'nowrap', fontFamily: 'inherit',
          }}>🔴</button>
        )}
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
          />
          <button onClick={() => saveClub(club)} style={{
            background: C.gold, color: C.deep, border: 'none', borderRadius: 6,
            padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'inherit', flexShrink: 0,
          }}>OK</button>
          {club && (
            <button onClick={() => saveClub('')} style={{
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
              onClick={() => onPubChange(t)}
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
  )
}
