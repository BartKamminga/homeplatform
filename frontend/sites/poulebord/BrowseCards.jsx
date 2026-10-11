import { useState } from 'react'
import { C, SEIZOEN_INFO, pinButtonStyle } from './constants.js'
import { useTournamentStandings } from './hooks.js'
import { CompetitionStandingsView } from './BrowseComponents.jsx'

// ── Season info ────────────────────────────────────────────────────────────────

export function SeizoenInfo({ cat, open, onToggle }) {
  const info = SEIZOEN_INFO[cat]
  if (!info) return null
  return (
    <div style={{ marginBottom: 10 }}>
      <button onClick={onToggle} style={{
        background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8,
        color: C.muted, fontSize: 11, padding: '4px 10px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'inherit',
      }}>
        <span>ℹ</span><span>Seizoensstructuur {cat}</span>
        <span style={{ fontSize: 9 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ background: C.deep, borderRadius: 10, padding: '12px', marginTop: 6,
          border: `1px solid ${C.border}`, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {info.map(fase => (
            <div key={fase.nr} style={{ flex: '1 1 150px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                <div style={{ background: C.gold, color: C.deep, borderRadius: '50%', width: 18, height: 18,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{fase.nr}</div>
                <div>
                  <div style={{ color: C.chalk, fontWeight: 700, fontSize: 11 }}>{fase.label}</div>
                  <div style={{ color: C.muted, fontSize: 9 }}>{fase.periode}</div>
                </div>
              </div>
              {fase.niveaus.map((n, i) => (
                <div key={i} style={{ fontSize: 10, color: C.muted, paddingLeft: 10, paddingBottom: 2,
                  borderLeft: `2px solid ${C.border}`, marginLeft: 8 }}>{n}</div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Standen-body (item 687, vereenvoudigd in item 1268) ───────────────────────
// Gedeeld door TournamentCard (hier) en CompactPinnedCard (PinnedBoard.jsx).
// Alleen Hockey Discovery; de Tournix-fallback is weg sinds de uitfasering.

export function StandingsBody({ useDiscovery, fasesData, club, dense = false }) {
  const style = { color: C.muted, fontSize: dense ? 12 : 13, padding: dense ? 8 : '10px 0', textAlign: 'center' }
  if (useDiscovery === null) return <div style={style}>Laden…</div>
  if (useDiscovery === false || !fasesData) {
    return <div style={{ ...style, fontStyle: 'italic' }}>No standings available yet</div>
  }
  return <CompetitionStandingsView fasesData={fasesData} club={club} />
}
// ── Tournament card (browse mode) ─────────────────────────────────────────────

export function TournamentCard({ tournament, club, pinned, onPin }) {
  const [open, setOpen] = useState(true)
  const { fasesData, useDiscovery } = useTournamentStandings(tournament.id)

  return (
    <div style={{ background: C.card, borderRadius: 12, overflow: 'hidden', marginBottom: 10,
      border: `1px solid ${C.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button onClick={() => setOpen(o => !o)} style={{
          flex: 1, padding: '13px 16px', background: 'transparent', border: 'none',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
        }}>
          <span style={{ flex: 1, color: C.chalk, fontWeight: 700, fontSize: 16,
            fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>
            {tournament.name}
          </span>
          <span style={{ color: C.muted, fontSize: 11 }}>{open ? '▲' : '▼'}</span>
        </button>
        <button onClick={onPin} title={pinned ? 'Verwijder competitie van board' : 'Pin competitie op board'}
          style={{ ...pinButtonStyle(pinned), marginRight: 12 }}>📌</button>
      </div>
      {open && (
        <div style={{ padding: '0 12px 12px' }}>
          {tournament.info && (
            <div style={{
              fontSize: 12, color: C.muted, lineHeight: 1.55,
              padding: '8px 10px', marginBottom: 10,
              background: 'rgba(255,255,255,0.04)', borderRadius: 8,
              borderLeft: `3px solid ${C.gold}`, whiteSpace: 'pre-wrap',
            }}>{tournament.info}</div>
          )}
          <StandingsBody useDiscovery={useDiscovery} fasesData={fasesData} club={club} />
        </div>
      )}
    </div>
  )
}
