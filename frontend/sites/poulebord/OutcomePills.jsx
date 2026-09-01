import { C } from './constants.js'

// "Wat als"-uitslagknop: home/away-team-naam voor H/A, "Gelijk" voor D
// (ScenarioModal.jsx). Een 2e klik op de al-actieve knop opent een +/-
// doelpunten-stepper (item 1034) i.p.v. de aanname op te heffen - dat gaat
// via het losse "wis"-knopje in ScenarioModal.jsx. De score is altijd
// leidend: elke aanpassing herleidt meteen de bijbehorende H/D/A-uitkomst,
// zodat outcome en score nooit uit de pas kunnen lopen (de backend wijst
// een inconsistent paar af, zie routers/hockey_scenario.py::_parse_fixed).
export function outcomeLabel(outcome, homeTeam, awayTeam) {
  if (outcome === 'H') return homeTeam
  if (outcome === 'A') return awayTeam
  return 'Gelijk'
}

export function outcomeFromScore(home, away) {
  if (home > away) return 'H'
  if (home < away) return 'A'
  return 'D'
}

const DEFAULT_SCORE = { H: [1, 0], D: [0, 0], A: [0, 1] }

export function OutcomePills({ match, fixedOutcome, fixedScore, recommendedOutcome, scoreOpen, onPick, onToggleScore, onScoreChange }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
        {['H', 'D', 'A'].map(outcome => {
          const active = fixedOutcome === outcome
          const recommended = !fixedOutcome && recommendedOutcome === outcome
          return (
            <button key={outcome} onClick={() => (active ? onToggleScore() : onPick(outcome))} style={{
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
      {scoreOpen && fixedOutcome && (
        <ScoreStepper score={fixedScore || DEFAULT_SCORE[fixedOutcome]} onChange={onScoreChange} />
      )}
    </div>
  )
}

function Stepper({ value, onDec, onInc }) {
  const btnStyle = { background: 'none', border: `1px solid ${C.border}`, borderRadius: 4,
    color: C.gold, width: 20, height: 20, cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1 }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <button onClick={onDec} style={btnStyle}>−</button>
      <span style={{ width: 16, textAlign: 'center', fontWeight: 700 }}>{value}</span>
      <button onClick={onInc} style={btnStyle}>+</button>
    </div>
  )
}

function ScoreStepper({ score, onChange }) {
  const [home, away] = score
  const step = (field, delta) => {
    const next = field === 'home' ? [Math.max(0, home + delta), away] : [home, Math.max(0, away + delta)]
    onChange(next)
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      marginTop: 6, fontSize: 12, color: C.chalk }}>
      <Stepper value={home} onDec={() => step('home', -1)} onInc={() => step('home', 1)} />
      <span style={{ color: C.muted }}>–</span>
      <Stepper value={away} onDec={() => step('away', -1)} onInc={() => step('away', 1)} />
    </div>
  )
}
