import { useState, useEffect } from 'react'
import { C } from './constants.js'
import { PoolTable } from './PoolTable.jsx'
import { getPoolMatches } from './api.js'

// Unified bottom-sheet modal for pool detail + matches (items 539 + 550).
//
// Props:
//   title:       string shown large in header (e.g. "POULE A" or poule.name)
//   subtitle:    string shown small below title
//   rows:        [{name, pts, w, d, l, gf?, ga?}]  — normalized standings
//   matches:     {finished:[{id,teamA,scoreA,scoreB,teamB}], scheduled:[{id,teamA,teamB}]} | null
//                Pass null to show "Laden…". Ignored when matchSource is set.
//   matchSource: {phaseId, poolName} — if provided, fetches Tournix matches internally
//   onClose:     fn
export function MatchModal({ title, subtitle, rows, matches: matchesProp, matchSource, onClose }) {
  const [matches, setMatches] = useState(matchSource ? null : (matchesProp ?? null))

  useEffect(() => {
    if (!matchSource) return
    getPoolMatches(matchSource.phaseId, matchSource.poolName)
      .then(data => setMatches({
        finished: (data.finished || []).map(m => ({
          id: m.id, teamA: m.team_a, scoreA: m.score_a, scoreB: m.score_b, teamB: m.team_b,
        })),
        scheduled: (data.scheduled || []).map(m => ({
          id: m.id, teamA: m.team_a, teamB: m.team_b,
        })),
      }))
      .catch(() => setMatches({ finished: [], scheduled: [] }))
  }, [matchSource?.phaseId, matchSource?.poolName])

  // When pre-fetched matches are passed in (Discovery case), keep in sync
  useEffect(() => {
    if (!matchSource) setMatches(matchesProp ?? null)
  }, [matchesProp, matchSource])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const played  = matches?.finished?.length ?? 0
  const total   = played + (matches?.scheduled?.length ?? 0)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'flex-end' }}
      onClick={onClose}>
      <div style={{ background: C.deep, borderRadius: '16px 16px 0 0', width: '100%',
        maxHeight: '82dvh', overflowY: 'auto',
        border: `1px solid ${C.border}`, borderBottom: 'none' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ position: 'sticky', top: 0, background: C.deep,
          padding: '14px 16px 10px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24,
                letterSpacing: '0.06em', color: C.gold, lineHeight: 1 }}>
                {title}
              </div>
              {/* item 550: match count badge */}
              {matches !== null && total > 0 && (
                <span style={{ fontSize: 11, color: C.muted, whiteSpace: 'nowrap' }}>
                  {played}/{total} gespeeld
                </span>
              )}
            </div>
            {subtitle && (
              <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{subtitle}</div>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'transparent',
            border: `1px solid ${C.border}`, borderRadius: 8,
            padding: '6px 12px', color: C.muted, fontSize: 13,
            cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
        </div>

        <div style={{ padding: '14px 14px 32px' }}>
          {/* Standings */}
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.10em',
            textTransform: 'uppercase', color: C.muted, marginBottom: 8 }}>Stand</div>
          <div style={{ background: C.card, borderRadius: 10, overflow: 'hidden', marginBottom: 18 }}>
            <PoolTable rows={rows} showGoals />
          </div>

          {/* Matches */}
          {matches === null ? (
            <div style={{ textAlign: 'center', color: C.muted, padding: '12px 0', fontSize: 13 }}>Laden…</div>
          ) : (
            <>
              {matches.finished.length > 0 && (
                <>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.10em',
                    textTransform: 'uppercase', color: C.muted, marginBottom: 8 }}>Gespeeld</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 18 }}>
                    {matches.finished.map(m => (
                      <div key={m.id} style={{ background: C.card, borderRadius: 8,
                        padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ flex: 1, fontSize: 12, color: C.chalk, textAlign: 'right',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.teamA}</span>
                        <span style={{ fontSize: 15, fontWeight: 700, color: C.gold,
                          letterSpacing: '0.04em', flexShrink: 0, minWidth: 44, textAlign: 'center' }}>
                          {m.scoreA}–{m.scoreB}
                        </span>
                        <span style={{ flex: 1, fontSize: 12, color: C.chalk,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.teamB}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {matches.scheduled.length > 0 && (
                <>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.10em',
                    textTransform: 'uppercase', color: C.muted, marginBottom: 8 }}>Nog te spelen</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {matches.scheduled.map(m => (
                      <div key={m.id} style={{ background: C.card, borderRadius: 8,
                        padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ flex: 1, fontSize: 12, color: C.chalk, textAlign: 'right',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.teamA}</span>
                        <span style={{ fontSize: 12, color: C.muted, flexShrink: 0,
                          minWidth: 44, textAlign: 'center' }}>vs</span>
                        <span style={{ flex: 1, fontSize: 12, color: C.chalk,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.teamB}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {matches.finished.length === 0 && matches.scheduled.length === 0 && (
                <div style={{ textAlign: 'center', color: C.muted, fontSize: 12,
                  fontStyle: 'italic', padding: '8px 0' }}>Geen wedstrijden gevonden</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
