import { useState, useEffect } from 'react'
import { C } from './constants.js'
import { getLiveMatches } from './api.js'

// item 1079: bottom-sheet met live wedstrijden (status=live) van de huidige
// publicatie - zelfde chrome als MatchModal.jsx, maar dan zonder stand/
// dag-groepering (een handjevol wedstrijden tegelijk, geen agenda).
const LIVE_POLL_MS = 20000

function LiveRow({ m }) {
  return (
    <div style={{ background: C.card, borderRadius: 8,
      padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 9, fontWeight: 700, color: '#e5484d', flexShrink: 0, minWidth: 34 }}>● LIVE</span>
      <span style={{ flex: 1, fontSize: 12, color: C.chalk, textAlign: 'right',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.home_team}</span>
      <span style={{ fontSize: 15, fontWeight: 700, color: C.gold,
        letterSpacing: '0.04em', flexShrink: 0, minWidth: 44, textAlign: 'center' }}>
        {m.home_score ?? 0}–{m.away_score ?? 0}
      </span>
      <span style={{ flex: 1, fontSize: 12, color: C.chalk,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.away_team}</span>
    </div>
  )
}

export function LiveMatchesModal({ open, tid, onClose }) {
  const [rows, setRows] = useState(null)

  useEffect(() => {
    if (!open || !tid) return
    let cancelled = false
    function load() {
      getLiveMatches(tid).then(data => { if (!cancelled) setRows(data.rows || []) })
        .catch(() => { if (!cancelled) setRows([]) })
    }
    load()
    const timer = setInterval(load, LIVE_POLL_MS)
    return () => { cancelled = true; clearInterval(timer) }
  }, [open, tid])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  if (!open) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'flex-end' }}
      onClick={onClose}>
      <div style={{ background: C.deep, borderRadius: '16px 16px 0 0', width: '100%',
        maxHeight: '82dvh', overflowY: 'auto',
        border: `1px solid ${C.border}`, borderBottom: 'none' }}
        onClick={e => e.stopPropagation()}>

        <div style={{ position: 'sticky', top: 0, background: C.deep,
          padding: '14px 16px 10px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, fontFamily: "'Bebas Neue', sans-serif", fontSize: 24,
            letterSpacing: '0.06em', color: C.gold, lineHeight: 1 }}>🔴 LIVE</div>
          <button onClick={onClose} style={{ background: 'transparent',
            border: `1px solid ${C.border}`, borderRadius: 8,
            padding: '6px 12px', color: C.muted, fontSize: 13,
            cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
        </div>

        <div style={{ padding: '14px 14px 32px' }}>
          {rows === null ? (
            <div style={{ textAlign: 'center', color: C.muted, padding: '12px 0', fontSize: 13 }}>Laden…</div>
          ) : rows.length === 0 ? (
            <div style={{ textAlign: 'center', color: C.muted, fontSize: 12,
              fontStyle: 'italic', padding: '8px 0' }}>Geen live wedstrijden op dit moment</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {rows.map(m => <LiveRow key={m.match_id} m={m} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
