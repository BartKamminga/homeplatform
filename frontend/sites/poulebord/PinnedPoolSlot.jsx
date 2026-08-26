import { useState, useEffect } from 'react'
import { C } from './constants.js'
import { useStandings } from './hooks.js'
import { MatchModal } from './MatchModal.jsx'
import { PouleCard } from './PouleCard.jsx'
import { ScenarioModal } from './ScenarioModal.jsx'
import { getHockeyPouleMatches } from './api.js'

// Verhuisd uit PinnedBoard.jsx (item 963-vervolg) om dat bestand onder de
// CLAUDE.md-bestandsgrens (300 regels) te houden nu er scenario-wiring bijkomt.

// ── Pinned pool slot (compact, board) ─────────────────────────────────────────
// De kaart zelf toont geen publicatienaam meer (staat al op de omliggende
// groep/kaart, item 682) - de wedstrijd-modal krijgt 'm nog wel mee als subtitel.

export function PinnedPoolSlot({ pin, club, onUnpin }) {
  const standings = useStandings(pin.phaseId)
  const isDisc    = pin.phaseId?.startsWith?.('disc_')
  const pid       = isDisc ? parseInt(String(pin.phaseId).replace('disc_', ''), 10) : null
  const poolRows  = standings
    ? (isDisc ? standings : standings.filter(r => r.pool_name === pin.poolName))
    : null
  const [modal, setModal] = useState(false)
  const [discMatches, setDiscMatches] = useState(null)
  const [scenarioTeam, setScenarioTeam] = useState(null)

  // item 895: gepinde discovery-poules toonden altijd 0 wedstrijden in de modal
  useEffect(() => {
    if (!modal || !isDisc || discMatches) return
    getHockeyPouleMatches(pid)
      .then(data => setDiscMatches({
        finished: (data.finished || []).map(m => ({
          id: m.match_id, teamA: m.home, scoreA: m.home_score, scoreB: m.away_score, teamB: m.away,
          date: m.date, round: m.round,
        })),
        scheduled: (data.scheduled || []).map(m => ({
          id: m.match_id, teamA: m.home, teamB: m.away,
          date: m.date, round: m.round,
        })),
      }))
      .catch(() => setDiscMatches({ finished: [], scheduled: [] }))
  }, [modal, isDisc, pid, discMatches])

  return (
    <div style={{ marginBottom: 8 }}>
      {modal && (
        <MatchModal
          title={pin.poolName}
          subtitle={pin.tournamentName || ''}
          rows={poolRows || []}
          matchSource={!isDisc ? { phaseId: pin.phaseId, poolName: pin.poolName } : undefined}
          matches={isDisc ? discMatches : undefined}
          onClose={() => setModal(false)}
        />
      )}
      {scenarioTeam && (
        <ScenarioModal
          pid={pid} teamId={scenarioTeam.team_id} teamName={scenarioTeam.name}
          onClose={() => setScenarioTeam(null)}
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
          onSelectTeam={isDisc ? setScenarioTeam : undefined}
          pinned={true}
          onTogglePin={onUnpin}
          note={isDisc ? poolRows.ai_note : undefined}
        />
      )}
    </div>
  )
}

// ── Pinned competitie (item 681: gepinde competitie als 1 kaart, geen losse
// poule-kaarten) ───────────────────────────────────────────────────────────────

export function PinnedCompetitionCard({ compName, pins, club, onUnpin }) {
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

export function PinnedBarePools({ pins, club, onUnpin }) {
  return (
    <>
      {pins.map(p => (
        <PinnedPoolSlot key={`${p.phaseId}::${p.poolName}`}
          pin={p} club={club} onUnpin={() => onUnpin(p.phaseId, p.poolName)} />
      ))}
    </>
  )
}
