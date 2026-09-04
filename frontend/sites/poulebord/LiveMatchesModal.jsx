import { useState, useEffect } from 'react'
import { C } from './constants.js'
import { getLiveMatches } from './api.js'
import { formatMatchTime } from '@core/matchDate.js'

// item 1079: bottom-sheet met live wedstrijden (status=live/final-vandaag) van
// de huidige publicatie - zelfde chrome als MatchModal.jsx. Gegroepeerd per
// competitie (met haar niveau-tags) en daarbinnen per poule (Bart, 4-09-2026:
// "MO14 - TopKlasse, Zuid Nederland - Poule B..."), zodat meerdere
// gelijktijdige wedstrijden niet als losse, ongelabelde rijen verschijnen.
const LIVE_POLL_MS = 20000

// Verwachte wedstrijdduur (Bart, 4-09-2026): 4 kwarten van 17,5 min + 2x
// ~2,5 min korte rust (Q1-Q2/Q3-Q4) + 10 min rust (Q2-Q3) = 85 min. Puur voor
// de weergave "verwacht einde" - geen koppeling met de admin-instelling
// match_duration_min (die stuurt scanmomenten, dit is displayinformatie).
const MATCH_DURATION_MIN = 4 * 17.5 + 2 * 2.5 + 10

function expectedEndTime(iso) {
  const start = new Date(iso)
  if (isNaN(start.getTime())) return null
  const end = new Date(start.getTime() + MATCH_DURATION_MIN * 60000)
  return end.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}

function LiveRow({ m }) {
  const isLive = m.status === 'live'
  const start = formatMatchTime(m.match_date)
  const end = isLive ? expectedEndTime(m.match_date) : null
  return (
    <div style={{ background: C.card, borderRadius: 8,
      padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, minWidth: 44 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: isLive ? '#e5484d' : C.muted }}>
          {isLive ? '● LIVE' : 'AFGELOPEN'}
        </span>
        <span style={{ fontSize: 9, color: C.muted, whiteSpace: 'nowrap' }}>
          {start}{end ? `–${end}` : ''}
        </span>
      </div>
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

function CompetitionGroup({ group }) {
  const label = group.tags?.length ? group.tags.join(', ') : group.competition_name
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: C.gold, marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {group.poules.map(poule => (
          <div key={poule.poule_name}>
            {group.poules.length > 1 && (
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>{poule.poule_name}</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {poule.matches.map(m => <LiveRow key={m.match_id} m={m} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function LiveMatchesModal({ open, tid, tournamentName, onClose }) {
  const [groups, setGroups] = useState(null)

  useEffect(() => {
    if (!open || !tid) return
    let cancelled = false
    function load() {
      getLiveMatches(tid).then(data => { if (!cancelled) setGroups(data.groups || []) })
        .catch(() => { if (!cancelled) setGroups([]) })
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
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24,
              letterSpacing: '0.06em', color: C.gold, lineHeight: 1 }}>🔴 LIVE</div>
            {tournamentName && (
              <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{tournamentName}</div>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'transparent',
            border: `1px solid ${C.border}`, borderRadius: 8,
            padding: '6px 12px', color: C.muted, fontSize: 13,
            cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
        </div>

        <div style={{ padding: '14px 14px 32px' }}>
          {groups === null ? (
            <div style={{ textAlign: 'center', color: C.muted, padding: '12px 0', fontSize: 13 }}>Laden…</div>
          ) : groups.length === 0 ? (
            <div style={{ textAlign: 'center', color: C.muted, fontSize: 12,
              fontStyle: 'italic', padding: '8px 0' }}>Geen live wedstrijden op dit moment</div>
          ) : (
            groups.map(g => <CompetitionGroup key={g.competition_name} group={g} />)
          )}
        </div>
      </div>
    </div>
  )
}
