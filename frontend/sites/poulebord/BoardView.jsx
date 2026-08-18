import { useState, useEffect } from 'react'
import { getBoard } from './api.js'
import { C, CATEGORIES, SEIZOEN_INFO } from './constants.js'
import { useStandings, useTournamentStandings } from './hooks.js'
import { MatchModal } from './MatchModal.jsx'
import { CompetitionStandingsView } from './BrowseComponents.jsx'
import { QueryCard } from './QueryCard.jsx'
import { PouleCard } from './PouleCard.jsx'

// ── Empty board ────────────────────────────────────────────────────────────────

export function EmptyBoard() {
  return (
    <div style={{ textAlign: 'center', padding: '52px 24px' }}>
      <div style={{ fontSize: 36, marginBottom: 14 }}>📌</div>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22,
        letterSpacing: '0.06em', marginBottom: 10, color: C.chalk }}>JE BOARD IS LEEG</div>
      <div style={{ color: C.muted, fontSize: 13, lineHeight: 1.7 }}>
        Stel je club in via ⭐ om automatisch alle NK-poules te zien.<br /><br />
        Of pin een competitie of poule tijdens het bladeren.
      </div>
    </div>
  )
}

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
          title={`POULE ${detailPool.poolName}`}
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
                  title={`POULE ${pname}`}
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

// ── Club pool card (board) ────────────────────────────────────────────────────

export function ClubPoolCard({ entry, club }) {
  const standings = useStandings(entry.phase_id)
  const [showDetail, setShowDetail] = useState(false)

  const poolRows = standings ? standings.filter(r => r.pool_name === entry.pool_name) : null

  return (
    <div style={{ marginBottom: 8 }}>
      {showDetail && poolRows?.length > 0 && (
        <MatchModal
          title={`POULE ${entry.pool_name}`}
          subtitle={entry.tournament_name}
          rows={poolRows}
          matchSource={{ phaseId: entry.phase_id, poolName: entry.pool_name }}
          onClose={() => setShowDetail(false)}
        />
      )}
      {poolRows === null ? (
        <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`,
          color: C.muted, fontSize: 12, textAlign: 'center', padding: 10 }}>Laden…</div>
      ) : (
        <PouleCard
          title={`POULE ${entry.pool_name}`}
          subtitle={entry.tournament_name}
          rows={poolRows}
          club={club}
          onOpen={poolRows.length > 0 ? () => setShowDetail(true) : undefined}
        />
      )}
    </div>
  )
}

// ── Pinned pool slot (compact, board) ─────────────────────────────────────────

function PinnedPoolSlot({ pin, club, idx, tournamentName }) {
  const standings = useStandings(pin.phaseId)
  const isDisc    = pin.phaseId?.startsWith?.('disc_')
  const poolRows  = standings
    ? (isDisc ? standings : standings.filter(r => r.pool_name === pin.poolName))
    : null
  const [modal, setModal] = useState(false)

  return (
    <div style={{ flex: '1 1 180px', borderLeft: idx > 0 ? `1px solid ${C.border}` : 'none' }}>
      {modal && (
        <MatchModal
          title={pin.poolName}
          subtitle={tournamentName || ''}
          rows={poolRows || []}
          matchSource={!isDisc ? { phaseId: pin.phaseId, poolName: pin.poolName } : undefined}
          matches={isDisc ? { finished: [], scheduled: [] } : undefined}
          onClose={() => setModal(false)}
        />
      )}
      {poolRows === null ? (
        <div style={{ color: C.muted, fontSize: 11, padding: 8, textAlign: 'center' }}>Laden…</div>
      ) : (
        <PouleCard
          title={pin.poolName}
          rows={poolRows}
          club={club}
          density="compact"
          onOpen={poolRows.length > 0 ? () => setModal(true) : undefined}
        />
      )}
    </div>
  )
}

export function PinnedPoolGroupCard({ tournamentName, pins, club, onUnpin }) {
  return (
    <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`,
      marginBottom: 8, overflow: 'hidden' }}>
      <div style={{ padding: '5px 8px 5px 10px', borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: C.chalk, flex: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {tournamentName}
        </span>
        {pins.map(p => (
          <span key={`${p.phaseId}::${p.poolName}`} style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            background: 'rgba(207,159,63,0.1)', border: `1px solid ${C.gold}`,
            borderRadius: 4, padding: '1px 4px', fontSize: 10, color: C.gold,
          }}>
            Poule {p.poolName}
            <button onClick={() => onUnpin(p.phaseId, p.poolName)} style={{
              background: 'none', border: 'none', padding: 0,
              cursor: 'pointer', color: C.muted, fontSize: 9, lineHeight: 1,
            }}>✕</button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
        {pins.map((p, idx) => (
          <PinnedPoolSlot key={`${p.phaseId}::${p.poolName}`}
            pin={p} club={club} idx={idx} tournamentName={tournamentName} />
        ))}
      </div>
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
        <button onClick={onPin} title={pinned ? 'Verwijder competitie van board' : 'Pin competitie op board'} style={{
          background: pinned ? 'rgba(207,159,63,0.15)' : 'transparent',
          border: `1px solid ${pinned ? C.gold : 'transparent'}`,
          borderRadius: 4, padding: '1px 5px', fontSize: 10,
          color: pinned ? C.gold : C.muted, cursor: 'pointer',
          lineHeight: 1.4, flexShrink: 0, marginRight: 12,
        }}>📌</button>
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

// ── Board section ─────────────────────────────────────────────────────────────

function BoardSection({ label, children }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
        textTransform: 'uppercase', color: C.muted,
        padding: '4px 2px 8px', borderTop: `1px solid ${C.border}` }}>
        {label}
      </div>
      {children}
    </div>
  )
}

// ── Board view ────────────────────────────────────────────────────────────────

export function BoardView({ club, pins, poolPins, allTournaments, onUnpin, onPoolUnpin,
  queryPins, onQueryUpdate, onQueryUnpin }) {
  const [boardData, setBoardData] = useState(null)

  useEffect(() => {
    if (!club) { setBoardData([]); return }
    getBoard(club, 'productie').then(setBoardData).catch(() => setBoardData([]))
  }, [club])

  const clubTournamentIds = new Set((boardData || []).map(e => e.tournament_id))
  const clubPhasePoolKeys = new Set((boardData || []).map(e => `${e.phase_id}::${e.pool_name}`))

  const pinnedTournaments = [...pins]
    .map(id => allTournaments?.find(t => t.id === id))
    .filter(t => t && !clubTournamentIds.has(t.id))

  const pinnedPools = [...poolPins.values()]
    .filter(p => !clubPhasePoolKeys.has(`${p.phaseId}::${p.poolName}`))

  const queryPinList = [...(queryPins?.values() ?? [])]

  const hasClub      = club && boardData !== null && boardData.length > 0
  const hasT         = pinnedTournaments.length > 0
  const hasP         = pinnedPools.length > 0
  const hasQ         = queryPinList.length > 0
  const hasPinned    = hasT || hasP || hasQ
  const showSubLabels = [hasT, hasP, hasQ].filter(Boolean).length > 1

  if (!club && !hasPinned) return <EmptyBoard />

  const byCategory = {}
  for (const entry of (boardData || [])) {
    const cat = entry.category || '—'
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat].push(entry)
  }

  return (
    <div style={{ padding: '12px 10px' }}>
      {club && boardData === null && (
        <div style={{ textAlign: 'center', color: C.muted, padding: '20px 0', fontSize: 13 }}>Laden…</div>
      )}
      {club && boardData !== null && boardData.length === 0 && (
        <div style={{ background: C.card, borderRadius: 10, padding: '14px 16px',
          color: C.muted, fontSize: 13, textAlign: 'center', marginBottom: 10,
          border: `1px solid ${C.border}` }}>
          Geen NK-poules gevonden voor <strong style={{ color: C.chalk }}>{club}</strong>
        </div>
      )}

      {CATEGORIES.filter(c => byCategory[c]).map(cat => (
        <div key={cat}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: C.gold, padding: '6px 2px 5px' }}>
            {cat}
          </div>
          {byCategory[cat].map(entry => (
            <ClubPoolCard key={`${entry.phase_id}-${entry.pool_name}`} entry={entry} club={club} />
          ))}
        </div>
      ))}

      {hasPinned && (
        <BoardSection label={hasClub ? 'Gepind' : undefined}>
          {showSubLabels && hasT && (
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.10em',
              textTransform: 'uppercase', color: C.muted, padding: '0 2px 6px' }}>
              Competities
            </div>
          )}
          {pinnedTournaments.map(t => (
            <CompactPinnedCard key={t.id} tournament={t} club={club} onUnpin={() => onUnpin(t.id)} />
          ))}

          {showSubLabels && hasP && (
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.10em',
              textTransform: 'uppercase', color: C.muted, padding: '8px 2px 6px' }}>
              Poules
            </div>
          )}
          {(() => {
            const grouped = {}
            for (const p of pinnedPools) {
              if (!grouped[p.tournamentName]) grouped[p.tournamentName] = []
              grouped[p.tournamentName].push(p)
            }
            return Object.entries(grouped)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([tn, gPins]) => (
                <PinnedPoolGroupCard
                  key={tn}
                  tournamentName={tn}
                  pins={gPins.sort((a, b) => a.poolName.localeCompare(b.poolName, undefined, { numeric: true }))}
                  club={club}
                  onUnpin={onPoolUnpin}
                />
              ))
          })()}

          {showSubLabels && hasQ && (
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.10em',
              textTransform: 'uppercase', color: C.muted, padding: '8px 2px 6px' }}>
              Queries
            </div>
          )}
          {[...(queryPins?.entries() ?? [])].map(([key, pin]) => (
            <QueryCard
              key={key}
              pin={pin}
              pinned={true}
              onTogglePin={() => onQueryUnpin(key)}
              onUpdate={patch => onQueryUpdate(key, patch)}
            />
          ))}
        </BoardSection>
      )}
    </div>
  )
}
