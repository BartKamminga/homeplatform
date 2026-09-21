import { useState, useEffect, useMemo } from 'react'
import { C, SEASON, MY_BOARDS_KEY } from './constants.js'
import { getBoardByCode, getHockeyPublications, getDiscoverySeason, saveBoard } from './api.js'
import { BoardView } from './PinnedBoard.jsx'

// Gedeeld bordlinkje (?b=CODE): toont alleen dit ene board, geen navigatie
// naar de rest van Poulebord - vervangt de vroegere sharedBoard-afhandeling
// binnen App.jsx, die achter AuthGate zat en dus nooit publiek werkte.
export default function StandaloneBoardView({ code }) {
  const [board, setBoard]         = useState(null)
  const [notFound, setNotFound]   = useState(false)
  const [season, setSeason]       = useState(SEASON)
  const [allRaw, setAllRaw]       = useState(null)
  const [pins, setPins]           = useState(new Set())
  const [poolPins, setPoolPins]   = useState(new Map())
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)

  useEffect(() => {
    getBoardByCode(code)
      .then(b => {
        setBoard(b)
        setPins(new Set(b.pins || []))
        setPoolPins(new Map((b.pool_pins || []).map(p => [`${p.phaseId}::${p.poolName}`, p])))
      })
      .catch(() => setNotFound(true))
  }, [code])

  useEffect(() => {
    getDiscoverySeason().then(r => { if (r.season) setSeason(r.season) }).catch(() => {})
  }, [])
  useEffect(() => {
    getHockeyPublications().then(setAllRaw).catch(() => setAllRaw([]))
  }, [])

  const all = useMemo(() => {
    if (allRaw === null) return null
    const norm = s => (s || '').replace(/\s*-\s*/g, '-')
    return allRaw.filter(t => norm(t.season) === norm(season))
  }, [allRaw, season])

  function onUnpin(id) {
    setPins(prev => { const next = new Set(prev); next.delete(id); return next })
  }
  function onPoolUnpin(phaseId, poolName) {
    setPoolPins(prev => { const next = new Map(prev); next.delete(`${phaseId}::${poolName}`); return next })
  }

  async function saveAsMine() {
    setSaving(true)
    try {
      const b = await saveBoard({
        name: board.name, club: board.club, pins: [...pins], pool_pins: [...poolPins.values()],
      })
      const entry = { code: b.id, name: b.name, club: b.club,
        pins: b.pins, pool_pins: b.pool_pins, savedAt: new Date().toISOString() }
      const list = JSON.parse(localStorage.getItem(MY_BOARDS_KEY) || '[]')
      localStorage.setItem(MY_BOARDS_KEY, JSON.stringify([entry, ...list.filter(x => x.code !== b.id)]))
      setSaved(true)
    } catch {
      alert('Opslaan mislukt')
    } finally {
      setSaving(false)
    }
  }

  if (notFound) {
    return (
      <div style={{ minHeight: '100dvh', background: C.bg, color: C.chalk, fontFamily: "'Inter', sans-serif",
        display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24 }}>
        <div>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🤷</div>
          <div style={{ color: C.muted, fontSize: 13 }}>Dit board bestaat niet (meer).</div>
        </div>
      </div>
    )
  }

  if (!board || all === null) return null

  return (
    <div style={{ minHeight: '100dvh', background: C.bg, fontFamily: "'Inter', sans-serif", color: C.chalk }}>
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: '0.05em',
          color: C.gold, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          📌 {board.name}
        </span>
        <button onClick={saveAsMine} disabled={saving || saved} style={{
          background: 'transparent', border: `1px solid ${C.gold}`, borderRadius: 16,
          padding: '4px 12px', fontSize: 10, color: C.gold, cursor: saved ? 'default' : 'pointer',
          fontFamily: 'inherit', opacity: saved ? 0.6 : 1, flexShrink: 0,
        }}>
          {saved ? 'Opgeslagen ✓' : saving ? 'Bezig...' : '💾 Opslaan als mijn board'}
        </button>
      </div>
      <BoardView
        club={board.club} pins={pins} poolPins={poolPins}
        allTournaments={all}
        onUnpin={onUnpin}
        onPoolUnpin={onPoolUnpin}
        queryPins={new Map()} onQueryUpdate={() => {}} onQueryUnpin={() => {}}
        filterPins={new Map()} onOpenFilterPin={() => {}} onRemoveFilterPin={() => {}}
      />
    </div>
  )
}
