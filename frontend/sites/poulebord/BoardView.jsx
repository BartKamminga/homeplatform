import { useState } from 'react'
import { C, SEIZOEN_INFO, pinButtonStyle } from './constants.js'
import { useStandings, useTournamentStandings } from './hooks.js'
import { MatchModal } from './MatchModal.jsx'
import { CompetitionStandingsView } from './BrowseComponents.jsx'
import { PouleCard } from './PouleCard.jsx'

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

// ── StandingsTable (browse mode, multiple pools) ──────────────────────────────

export function StandingsTable({ rows, club, phaseId, poolPins, onPoolPin, tournamentName }) {
  const [detailPool, setDetailPool] = useState(null)

  const byPool = {}
  for (const r of rows) {
    const key = r.pool_name ?? '—'
    if (!byPool[key]) byPool[key] = []
    byPool[key].push(r)
  }

  return (
    <>
      {detailPool && (
        <MatchModal
          title={detailPool.poolName}
          subtitle={tournamentName || ''}
          rows={detailPool.rows}
          matchSource={{ phaseId, poolName: detailPool.poolName }}
          onClose={() => setDetailPool(null)}
        />
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {Object.entries(byPool)
          .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
          .map(([pname, prows]) => {
            const pinKey   = `${phaseId}::${pname}`
            const isPinned = poolPins?.has(pinKey)
            return (
              <div key={pname} style={{ flex: '1 1 240px' }}>
                <PouleCard
                  title={pname}
                  rows={prows}
                  club={club}
                  onOpen={() => setDetailPool({ poolName: pname, rows: prows })}
                  pinned={onPoolPin ? isPinned : undefined}
                  onTogglePin={onPoolPin ? () => onPoolPin(phaseId, pname) : undefined}
                />
              </div>
            )
          })}
      </div>
    </>
  )
}

// ── Phase card ────────────────────────────────────────────────────────────────

export function PhaseCard({ phase, club, poolPins, onPoolPin, tournamentName }) {
  const standings = useStandings(phase.phase_type === 'pool' ? phase.id : null)
  if (phase.phase_type !== 'pool') return null
  return (
    <div style={{ marginBottom: 4 }}>
      {phase.name && (
        <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.06em', textTransform: 'uppercase',
          padding: '8px 0 6px', fontWeight: 600 }}>{phase.name}</div>
      )}
      {standings === null
        ? <div style={{ color: C.muted, fontSize: 13, padding: '10px 0', textAlign: 'center' }}>Laden…</div>
        : standings.length === 0
          ? <div style={{ color: C.muted, fontSize: 13, padding: '10px 0', textAlign: 'center', fontStyle: 'italic' }}>
              Nog geen wedstrijden gespeeld
            </div>
          : <StandingsTable rows={standings} club={club}
              phaseId={phase.id} poolPins={poolPins} onPoolPin={onPoolPin}
              tournamentName={tournamentName} />
      }
    </div>
  )
}

// ── Compact pinned tournament card (board) ────────────────────────────────────

export function CompactPinnedCard({ tournament, club, onUnpin }) {
  const [open, setOpen] = useState(true)
  const { fasesData, useDiscovery, phases, poolPhases } = useTournamentStandings(tournament.id)

  return (
    <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`,
      marginBottom: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <button onClick={() => setOpen(o => !o)} style={{
          flex: 1, padding: '12px 16px', background: 'transparent', border: 'none',
          cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ flex: 1, color: C.chalk, fontWeight: 700, fontSize: 15,
            fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>
            {tournament.name}
          </span>
          <span style={{ color: C.muted, fontSize: 10 }}>{open ? '▲' : '▼'}</span>
        </button>
        <button onClick={onUnpin} style={{
          background: 'transparent', border: 'none',
          borderLeft: `1px solid ${C.border}`,
          padding: '0 14px', fontSize: 12, color: C.muted, cursor: 'pointer', flexShrink: 0,
        }}>✕</button>
      </div>
      {open && (
        <div style={{ padding: '0 12px 12px' }}>
          {useDiscovery === null && (
            <div style={{ color: C.muted, fontSize: 12, textAlign: 'center', padding: 8 }}>Laden…</div>
          )}
          {useDiscovery === true && fasesData && (
            <CompetitionStandingsView fasesData={fasesData} club={club} />
          )}
          {useDiscovery === false && (
            phases === null
              ? <div style={{ color: C.muted, fontSize: 12, textAlign: 'center', padding: 8 }}>Laden…</div>
              : poolPhases.length === 0
                ? <div style={{ color: C.muted, fontSize: 12, textAlign: 'center', padding: 8, fontStyle: 'italic' }}>
                    Geen poulefases
                  </div>
                : poolPhases.map(p => <PhaseCard key={p.id} phase={p} club={club} tournamentName={tournament.name} />)
          )}
        </div>
      )}
    </div>
  )
}

// ── Tournament card (browse mode) ─────────────────────────────────────────────

export function TournamentCard({ tournament, club, pinned, onPin, poolPins, onPoolPin }) {
  const [open, setOpen] = useState(true)
  const { fasesData, useDiscovery, phases, poolPhases } = useTournamentStandings(tournament.id)

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
          {useDiscovery === null && (
            <div style={{ color: C.muted, fontSize: 13, padding: '10px 0', textAlign: 'center' }}>Laden…</div>
          )}
          {useDiscovery === true && fasesData && (
            <CompetitionStandingsView fasesData={fasesData} club={club} />
          )}
          {useDiscovery === false && (
            phases === null
              ? <div style={{ color: C.muted, fontSize: 13, padding: '10px 0', textAlign: 'center' }}>Laden…</div>
              : poolPhases.length === 0
                ? <div style={{ color: C.muted, fontSize: 13, padding: '10px 0', textAlign: 'center', fontStyle: 'italic' }}>
                    Geen poulefases gevonden
                  </div>
                : poolPhases.map(p => (
                    <PhaseCard key={p.id} phase={p} club={club}
                      poolPins={poolPins} onPoolPin={onPoolPin}
                      tournamentName={tournament.name} />
                  ))
          )}
        </div>
      )}
    </div>
  )
}
