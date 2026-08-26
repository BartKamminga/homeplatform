import { useState } from 'react'
import { getCompetitionMatches } from './api.js'
import { C, badgeStyle, pinButtonStyle, pinRailButtonStyle } from './constants.js'
import { MatchModal } from './MatchModal.jsx'
import { PouleCard } from './PouleCard.jsx'
import { ScenarioModal } from './ScenarioModal.jsx'

// ── Discovery poule table ─────────────────────────────────────────────────────

export function DiscPouleTable({ poule, club, onPin, isPinned, onOpenMatches }) {
  const [scenarioTeam, setScenarioTeam] = useState(null)
  const rows = (poule.standings || []).map(r => ({
    id: r.team_name, team_id: r.team_id, name: r.team_name, pts: r.pts, club_logo_url: r.club_logo_url,
    played: r.played, streak: r.streak, w: r.won, d: r.drawn, l: r.lost, gf: r.gf, ga: r.ga, note: r.ai_note,
  }))

  return (
    <>
      {scenarioTeam && (
        <ScenarioModal
          key={scenarioTeam.team_id}
          pid={poule.id} teamId={scenarioTeam.team_id} teamName={scenarioTeam.name}
          onClose={() => setScenarioTeam(null)}
        />
      )}
      <PouleCard
        title={poule.name}
        rows={rows}
        club={club}
        onOpen={onOpenMatches}
        onSelectTeam={setScenarioTeam}
        pinned={onPin ? isPinned : undefined}
        onTogglePin={onPin}
        note={poule.ai_note}
      />
    </>
  )
}

// ── Competition standings (discovery-based) ───────────────────────────────────

export function CompetitionStandingsView({ fasesData, club }) {
  return (
    <div>
      {fasesData.map(fase => (
        <div key={fase.fase} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.06em', textTransform: 'uppercase',
            padding: '8px 0 6px', fontWeight: 600 }}>{fase.label}</div>
          {fase.competitions.map(comp => (
            <div key={comp.link_id} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: C.chalk, fontWeight: 600, marginBottom: 6 }}>
                {comp.hockey_type === 'ZA' ? '🏒 ' : '🏑 '}{comp.name}
              </div>
              {comp.poules.length === 0 ? (
                <div style={{ fontSize: 12, color: C.muted, fontStyle: 'italic', paddingLeft: 4 }}>
                  Geen poules gevonden
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {comp.poules.map(poule => (
                    <div key={poule.id} style={{ flex: '1 1 240px' }}>
                      <DiscPouleTable poule={poule} club={club} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Pool search result card ───────────────────────────────────────────────────

export function PoolSearchCard({ result, poolPins, onPoolPin, onOpen }) {
  const key = `${result.phase_id}::${result.pool_name}`
  const isPinned = poolPins?.has(key)
  const openable = !!onOpen
  return (
    <div style={{ background: C.card, borderRadius: 10,
      border: `1px solid ${isPinned ? C.gold : C.border}`,
      marginBottom: 6, overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
      <div
        onClick={openable ? () => onOpen(result) : undefined}
        style={{ flex: 1, padding: '8px 12px', cursor: openable ? 'pointer' : 'default' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.gold, letterSpacing: '0.06em' }}>
          {result.pool_name}{openable && <span style={{ color: C.muted, fontSize: 9 }}> ›</span>}
        </div>
        <div style={{ fontSize: 11, color: C.chalk, marginTop: 2 }}>{result.tournament_name}</div>
        <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>{result.matched_team}</div>
        {result.tags?.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
            {result.tags.map((tag, i) => (
              <span key={i} style={badgeStyle()}>{tag}</span>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={e => { e.stopPropagation(); onPoolPin(result.phase_id, result.pool_name, result.tournament_name) }}
        title={isPinned ? 'Verwijder van board' : 'Pin deze poule op je board'}
        style={{ ...pinButtonStyle(isPinned, 'sm'), margin: '0 12px' }}
      >📌</button>
    </div>
  )
}

// ── Browse: expandable competition item ───────────────────────────────────────

export function CompBrowseItem({ comp, club, expanded, onToggle, poolPins, onPoolPin }) {
  const [matchesPoule, setMatchesPoule] = useState(null)
  const [matchesData,  setMatchesData]  = useState(null)

  const poules = comp.poules ?? []
  const allPinned = poules.length > 0 && poules.every(p => poolPins?.has('disc_' + p.id + '::' + p.name))

  function toggleCompPin(e) {
    e.stopPropagation()
    if (!poules.length || !onPoolPin) return
    poules.forEach(p => {
      const pinned = poolPins?.has('disc_' + p.id + '::' + p.name)
      if (allPinned ? pinned : !pinned) onPoolPin('disc_' + p.id, p.name, comp.name)
    })
  }

  function openMatches(poule) {
    setMatchesPoule(poule)
    setMatchesData(null)
    getCompetitionMatches(comp.id)
      .then(data => {
        const found = (data.poules || []).find(p => p.id === poule.id)
        const raw   = found || { finished: [], scheduled: [] }
        // Normalize to MatchModal format
        setMatchesData({
          finished: raw.finished.map(m => ({
            id: m.match_id, teamA: m.home, scoreA: m.home_score, scoreB: m.away_score, teamB: m.away,
            date: m.date, round: m.round,
          })),
          scheduled: raw.scheduled.map(m => ({
            id: m.match_id, teamA: m.home, teamB: m.away,
            date: m.date, round: m.round,
          })),
        })
      })
      .catch(() => setMatchesData({ finished: [], scheduled: [] }))
  }

  const tags = (comp.fase_tags || []).map(t => t.name)

  // Normalize discovery standings for MatchModal
  const modalRows = matchesPoule
    ? (matchesPoule.standings || []).map(r => ({
        id: r.team_name, name: r.team_name, pts: r.pts, club_logo_url: r.club_logo_url,
        played: r.played, streak: r.streak, w: r.won, d: r.drawn, l: r.lost, gf: r.gf, ga: r.ga,
      }))
    : []

  return (
    <>
      {matchesPoule && (
        <MatchModal
          title={matchesPoule.name}
          subtitle={comp.name}
          rows={modalRows}
          matches={matchesData}
          onClose={() => setMatchesPoule(null)}
        />
      )}
      <div style={{ background: C.card, borderRadius: 12, marginBottom: 8,
        overflow: 'hidden', border: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          <button onClick={onToggle} style={{
            flex: 1, padding: '12px 16px', background: 'transparent', border: 'none',
            cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 10, minWidth: 0,
          }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>{comp.hockey_type === 'ZA' ? '🏒' : '🏑'}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.04em',
                fontSize: 15, color: C.chalk, lineHeight: 1.2 }}>{comp.name}</div>
              {tags.length > 0 && (
                <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
                  {tags.map((tag, i) => (
                    <span key={i} style={badgeStyle()}>{tag}</span>
                  ))}
                </div>
              )}
            </span>
            <span style={{ color: C.muted, fontSize: 11, flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
          </button>
          {onPoolPin && poules.length > 0 && (
            <button onClick={toggleCompPin} title={allPinned ? 'Verwijder competitie van board' : 'Pin hele competitie op board'}
              style={pinRailButtonStyle(allPinned)}>📌</button>
          )}
        </div>
        {expanded && (
          <div style={{ padding: '0 12px 12px', borderTop: `1px solid ${C.border}` }}>
            {(comp.poules ?? []).length === 0 ? (
              <div style={{ color: C.muted, fontSize: 12, fontStyle: 'italic',
                padding: '10px 0', textAlign: 'center' }}>Geen poules gevonden</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                {comp.poules.map(poule => (
                  <div key={poule.id} style={{ flex: '1 1 240px' }}>
                    <DiscPouleTable
                      poule={poule}
                      club={club}
                      onPin={onPoolPin ? () => onPoolPin('disc_' + poule.id, poule.name, comp.name) : undefined}
                      isPinned={poolPins?.has('disc_' + poule.id + '::' + poule.name)}
                      onOpenMatches={() => openMatches(poule)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
