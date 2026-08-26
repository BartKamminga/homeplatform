import { useState, useEffect } from 'react'
import { C } from './constants.js'
import { useScenario, usePositionDistribution } from './useScenario.js'

// Bottom-sheet modal voor het eindpositie-scenario van 1 team (item 963-
// vervolg) - zelfde sjabloon als MatchModal.jsx. Toont het backend-verdict
// (guaranteed/impossible/depends) + de doorslaggevende resterende
// wedstrijden + de caveats (puntenregel/tiebreak-aannames) uit
// GET /api/hockey/public/hockey-poules/{pid}/simulate.
//
// Props:
//   pid:      interne HockeyPoule.id
//   teamId:   hockey.nl team id
//   teamName: string, getoond als titel
//   onClose:  fn

const VERDICT_STYLE = {
  guaranteed: { label: 'Gegarandeerd', color: '#6fbf8b' },
  impossible: { label: 'Onmogelijk', color: '#d97a6c' },
  depends:    { label: 'Afhankelijk van resterende wedstrijden', color: C.gold },
}

// "Wat als"-uitslagknop: home/away-team-naam voor H/A, "Gelijk" voor D.
function outcomeLabel(outcome, homeTeam, awayTeam) {
  if (outcome === 'H') return homeTeam
  if (outcome === 'A') return awayTeam
  return 'Gelijk'
}

function OutcomePills({ match, fixedOutcome, recommendedOutcome, onPick }) {
  return (
    <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
      {['H', 'D', 'A'].map(outcome => {
        const active = fixedOutcome === outcome
        const recommended = !fixedOutcome && recommendedOutcome === outcome
        return (
          <button key={outcome} onClick={() => onPick(outcome)} style={{
            flex: 1, fontSize: 10, padding: '4px 2px', borderRadius: 6, cursor: 'pointer',
            fontFamily: 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            background: active ? C.gold : 'transparent',
            color: active ? C.deep : recommended ? '#6fbf8b' : C.muted,
            border: `1px solid ${active ? C.gold : recommended ? '#6fbf8b' : C.border}`,
          }}>
            {outcomeLabel(outcome, match.home_team, match.away_team)}
          </button>
        )
      })}
    </div>
  )
}

// Balkjes met de kans op elke eindpositie tegelijk (item 963-vervolg) - elke
// rij is klikbaar en bepaalt de "Positie <= N"-vraag voor de doorslaggevende-
// wedstrijden-sectie eronder (vervangt het losse getalveld van eerst).
function PositionDistributionChart({ distribution, selected, onSelect }) {
  if (!distribution) return null
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.10em',
        textTransform: 'uppercase', color: C.muted, marginBottom: 8 }}>
        Kans per eindpositie <span style={{ textTransform: 'none', fontWeight: 400 }}>(klik om te verkennen)</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {Object.entries(distribution.position_probabilities).map(([position, p]) => {
          const isSelected = Number(position) === selected
          return (
            <button key={position} onClick={() => onSelect(Number(position))} style={{
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, background: 'none',
              border: `1px solid ${isSelected ? C.gold : 'transparent'}`, borderRadius: 4,
              padding: '2px 4px', margin: '-2px -4px', cursor: 'pointer', fontFamily: 'inherit', width: '100%',
            }}>
              <span style={{ width: 14, color: isSelected ? C.gold : C.muted, textAlign: 'right', flexShrink: 0,
                fontWeight: isSelected ? 700 : 400 }}>{position}</span>
              <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 4, height: 14, overflow: 'hidden' }}>
                <div style={{ width: `${Math.round(p * 100)}%`, background: isSelected ? C.goldBr : C.gold, height: '100%' }} />
              </div>
              <span style={{ width: 34, color: C.chalk, textAlign: 'right', flexShrink: 0 }}>{Math.round(p * 100)}%</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function ScenarioModal({ pid, teamId, teamName, onClose }) {
  const [targetPosition, setTargetPosition] = useState(1)
  const [fixed, setFixed] = useState({})           // { matchId: outcome }
  // Een wedstrijd blijft op zijn plek staan nadat 'm is vastgezet (ook al
  // levert de backend 'm dan niet meer als pivotal terug) - matchOrder/
  // matchInfo onthouden welke wedstrijden ooit getoond zijn en hoe ze eruit
  // zagen, zodat de rij niet verdwijnt en het kruisje bereikbaar blijft.
  const [matchOrder, setMatchOrder] = useState([])
  const [matchInfo, setMatchInfo] = useState({})
  const { data, error } = useScenario(pid, teamId, targetPosition, fixed)
  const { data: distribution } = usePositionDistribution(pid, teamId, fixed)
  const verdictInfo = data ? VERDICT_STYLE[data.verdict] : null

  useEffect(() => {
    setMatchOrder([])
    setMatchInfo({})
  }, [targetPosition])

  useEffect(() => {
    if (!data?.pivotal_matches) return
    setMatchOrder(prev => {
      const known = new Set(prev)
      const additions = data.pivotal_matches.map(m => m.match_id).filter(id => !known.has(id))
      return additions.length ? [...prev, ...additions] : prev
    })
    setMatchInfo(prev => {
      const next = { ...prev }
      for (const m of data.pivotal_matches) next[m.match_id] = m
      return next
    })
  }, [data])

  function pickOutcome(matchId, outcome) {
    setFixed(prev => {
      const next = { ...prev }
      if (next[matchId] === outcome) delete next[matchId]  // nogmaals klikken = aanname opheffen
      else next[matchId] = outcome
      return next
    })
  }

  function clearFixed(matchId) {
    setFixed(prev => { const next = { ...prev }; delete next[matchId]; return next })
  }

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

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
              letterSpacing: '0.06em', color: C.gold, lineHeight: 1 }}>
              {teamName}
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>Eindpositie-scenario</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent',
            border: `1px solid ${C.border}`, borderRadius: 8,
            padding: '6px 12px', color: C.muted, fontSize: 13,
            cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
        </div>

        <div style={{ padding: '14px 14px 32px' }}>
          <PositionDistributionChart distribution={distribution} selected={targetPosition} onSelect={setTargetPosition} />

          {error && (
            <div style={{ textAlign: 'center', color: C.muted, fontSize: 13, padding: '12px 0' }}>{error}</div>
          )}
          {!error && !data && (
            <div style={{ textAlign: 'center', color: C.muted, fontSize: 13, padding: '12px 0' }}>Laden…</div>
          )}
          {data && (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, color: verdictInfo.color,
                marginBottom: data.verdict === 'depends' && data.goal_probability != null ? 4 : 12 }}>
                {verdictInfo.label}
              </div>
              {data.verdict === 'depends' && data.goal_probability != null && (
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
                  {Math.round(data.goal_probability * 100)}% van {data.confidence === 'sampled' ? 'de steekproef' : 'de scenario\'s'} komt hierop uit
                </div>
              )}

              {matchOrder.length > 0 && (
                <>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.10em',
                    textTransform: 'uppercase', color: C.muted, marginBottom: 8 }}>
                    Doorslaggevende wedstrijden voor positie ≤ {targetPosition}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
                    {matchOrder.map(matchId => {
                      const m = matchInfo[matchId]
                      if (!m) return null
                      const isFixed = fixed[matchId] != null
                      return (
                        <div key={matchId} style={{ background: C.card, borderRadius: 8,
                          padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ flex: 1, color: C.chalk, textAlign: 'right',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.home_team}</span>
                            <span style={{ color: C.muted, fontSize: 11, flexShrink: 0 }}>vs</span>
                            <span style={{ flex: 1, color: C.chalk,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.away_team}</span>
                            {m.round != null && (
                              <span style={{ color: C.muted, fontSize: 10, flexShrink: 0 }}>R{m.round}</span>
                            )}
                          </div>
                          {isFixed ? (
                            <div style={{ fontSize: 10, color: C.gold, textAlign: 'center',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                              Aanname: {outcomeLabel(fixed[matchId], m.home_team, m.away_team)}
                              <button onClick={() => clearFixed(matchId)} style={{
                                background: 'none', border: 'none', padding: 0, color: C.gold,
                                cursor: 'pointer', fontSize: 11, lineHeight: 1 }}>✕ wis</button>
                            </div>
                          ) : m.hint && (
                            <div style={{ fontSize: 10, color: m.hint.required ? '#6fbf8b' : C.muted, textAlign: 'center' }}>
                              {m.hint.required ? '✓ ' : ''}{m.hint.label}
                              {!m.hint.required && ` (${Math.round(m.hint.recommended_rate * 100)}% kans)`}
                            </div>
                          )}
                          <OutcomePills
                            match={m}
                            fixedOutcome={fixed[matchId]}
                            recommendedOutcome={m.hint?.recommended_outcome}
                            onPick={outcome => pickOutcome(matchId, outcome)}
                          />
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              {data.caveats?.length > 0 && (
                <div style={{ fontSize: 10, color: C.muted, lineHeight: 1.5 }}>
                  {data.caveats.map((c, i) => <div key={i}>· {c}</div>)}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
