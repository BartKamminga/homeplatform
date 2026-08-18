import { useState } from 'react'
import { C, pinRailButtonStyle } from './constants.js'
import { useStandings } from './hooks.js'
import { MatchModal } from './MatchModal.jsx'
import { QueryCard } from './QueryCard.jsx'
import { PouleCard } from './PouleCard.jsx'
import { CompactPinnedCard } from './BoardView.jsx'

// ── Empty board ────────────────────────────────────────────────────────────────

export function EmptyBoard() {
  return (
    <div style={{ textAlign: 'center', padding: '52px 24px' }}>
      <div style={{ fontSize: 36, marginBottom: 14 }}>📌</div>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22,
        letterSpacing: '0.06em', marginBottom: 10, color: C.chalk }}>JE BOARD IS LEEG</div>
      <div style={{ color: C.muted, fontSize: 13, lineHeight: 1.7 }}>
        Pin een competitie of poule tijdens het bladeren om 'm hier terug te zien.
      </div>
    </div>
  )
}

// ── Pinned pool slot (compact, board) ─────────────────────────────────────────
// De kaart zelf toont geen publicatienaam meer (staat al op de omliggende
// groep/kaart, item 682) - de wedstrijd-modal krijgt 'm nog wel mee als subtitel.

function PinnedPoolSlot({ pin, club, onUnpin }) {
  const standings = useStandings(pin.phaseId)
  const isDisc    = pin.phaseId?.startsWith?.('disc_')
  const poolRows  = standings
    ? (isDisc ? standings : standings.filter(r => r.pool_name === pin.poolName))
    : null
  const [modal, setModal] = useState(false)

  return (
    <div style={{ marginBottom: 8 }}>
      {modal && (
        <MatchModal
          title={pin.poolName}
          subtitle={pin.tournamentName || ''}
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
          onOpen={poolRows.length > 0 ? () => setModal(true) : undefined}
          pinned={true}
          onTogglePin={onUnpin}
        />
      )}
    </div>
  )
}

// ── Pinned competitie (item 681: gepinde competitie als 1 kaart, geen losse
// poule-kaarten) ───────────────────────────────────────────────────────────────

function PinnedCompetitionCard({ compName, pins, club, onUnpin }) {
  return (
    <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`,
      marginBottom: 10, overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px 2px', fontFamily: "'Bebas Neue', sans-serif",
        fontSize: 14, letterSpacing: '0.05em', color: C.chalk }}>{compName}</div>
      <div style={{ padding: '6px 12px 10px' }}>
        {pins.map(p => (
          <PinnedPoolSlot key={`${p.phaseId}::${p.poolName}`}
            pin={p} club={club} onUnpin={() => onUnpin(p.phaseId, p.poolName)} />
        ))}
      </div>
    </div>
  )
}

// ── Losse gepinde poules zonder bekende competitie (bv. via zoeken gepind) ────

function PinnedBarePools({ pins, club, onUnpin }) {
  return (
    <>
      {pins.map(p => (
        <PinnedPoolSlot key={`${p.phaseId}::${p.poolName}`}
          pin={p} club={club} onUnpin={() => onUnpin(p.phaseId, p.poolName)} />
      ))}
    </>
  )
}

// ── Gepinde filter-snelkoppeling (item 683) ───────────────────────────────────

function PinnedFilterRow({ pin, onOpen, onUnpin }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
      marginBottom: 6, display: 'flex', alignItems: 'center' }}>
      <button onClick={onOpen} style={{
        flex: 1, minWidth: 0, background: 'transparent', border: 'none', padding: '7px 10px',
        cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{ fontSize: 11 }}>🔍</span>
        <span style={{ fontSize: 12, color: C.chalk, flex: 1, minWidth: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {pin.tags.length > 0 ? pin.tags.join(', ') : 'Alle niveaus'}
        </span>
        <span style={{ color: C.muted, fontSize: 9 }}>›</span>
      </button>
      <button onClick={onUnpin} title="Verwijder deze filter van board"
        style={{ ...pinRailButtonStyle(true), height: '100%' }}>📌</button>
    </div>
  )
}

// ── Publicatie-groep (item 682: naam tonen, inklapbaar bij >1 publicatie) ─────

function PublicationGroup({ name, collapsible, children }) {
  const [open, setOpen] = useState(true)
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ marginBottom: 8 }}>
        {collapsible ? (
          <button onClick={() => setOpen(o => !o)} style={{
            background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit',
          }}>
            <span style={{ color: C.muted, fontSize: 10 }}>{open ? '▼' : '▶'}</span>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15,
              letterSpacing: '0.05em', color: C.gold }}>{name}</span>
          </button>
        ) : (
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15,
            letterSpacing: '0.05em', color: C.gold }}>{name}</span>
        )}
      </div>
      {open && children}
    </div>
  )
}

// ── Board view ────────────────────────────────────────────────────────────────

export function BoardView({ club, pins, poolPins, allTournaments, onUnpin, onPoolUnpin,
  queryPins, onQueryUpdate, onQueryUnpin,
  filterPins, onOpenFilterPin, onRemoveFilterPin }) {
  const pinnedTournaments = [...pins]
    .map(id => allTournaments?.find(t => t.id === id))
    .filter(Boolean)
  const pinnedPools    = [...poolPins.values()]
  const queryPinList   = [...(queryPins?.entries() ?? [])].map(([key, pin]) => ({ key, pin }))
  const filterPinList  = [...(filterPins?.entries() ?? [])].map(([key, pin]) => ({ key, pin }))

  if (!pinnedTournaments.length && !pinnedPools.length && !queryPinList.length && !filterPinList.length) {
    return <EmptyBoard />
  }

  // Alles groeperen per publicatie(naam) - item 682. Volgorde: eerst volledig
  // gepinde publicaties, dan publicaties die alleen via losse poules/queries/
  // filters op het board staan.
  const order  = []
  const groups = {}
  function ensure(name) {
    if (!groups[name]) { groups[name] = { tournament: null, pools: [], queries: [], filters: [] }; order.push(name) }
    return groups[name]
  }
  pinnedTournaments.forEach(t => { ensure(t.name).tournament = t })
  pinnedPools.forEach(p => ensure(p.tournamentName || '—').pools.push(p))
  queryPinList.forEach(q => ensure(q.pin.tournamentName || '—').queries.push(q))
  filterPinList.forEach(f => ensure(f.pin.tournamentName || '—').filters.push(f))

  const collapsible = order.length > 1

  return (
    <div style={{ padding: '12px 10px' }}>
      {order.map(name => {
        const g = groups[name]
        const hasExtra = g.pools.length > 0 || g.queries.length > 0 || g.filters.length > 0

        const byComp = {}
        const barePools = []
        for (const p of g.pools) {
          if (p.compName) (byComp[p.compName] ||= []).push(p)
          else barePools.push(p)
        }

        const body = (
          <>
            {g.tournament && (
              <CompactPinnedCard tournament={g.tournament} club={club} onUnpin={() => onUnpin(g.tournament.id)} />
            )}
            {g.filters.map(({ key, pin }) => (
              <PinnedFilterRow key={key} pin={pin}
                onOpen={() => onOpenFilterPin(pin)}
                onUnpin={() => onRemoveFilterPin(key)} />
            ))}
            {Object.entries(byComp)
              .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
              .map(([compName, cPins]) => (
                <PinnedCompetitionCard key={compName} compName={compName}
                  pins={cPins.sort((a, b) => a.poolName.localeCompare(b.poolName, undefined, { numeric: true }))}
                  club={club} onUnpin={onPoolUnpin} />
              ))}
            {barePools.length > 0 && (
              <PinnedBarePools
                pins={barePools.sort((a, b) => a.poolName.localeCompare(b.poolName, undefined, { numeric: true }))}
                club={club} onUnpin={onPoolUnpin} />
            )}
            {g.queries.map(({ key, pin }) => (
              <QueryCard
                key={key}
                pin={pin}
                pinned={true}
                onTogglePin={() => onQueryUnpin(key)}
                onUpdate={patch => onQueryUpdate(key, patch)}
              />
            ))}
          </>
        )

        return hasExtra ? (
          <PublicationGroup key={name} name={name} collapsible={collapsible}>{body}</PublicationGroup>
        ) : (
          <div key={name} style={{ marginBottom: 14 }}>{body}</div>
        )
      })}
    </div>
  )
}
