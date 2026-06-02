import React, { useMemo } from 'react'
import { NK14_SLOTS, POULE_ORDER_14 } from '../../constants'
import SimPouleCard from './SimPouleCard'
import SectionLabel from './SectionLabel'
import { getExpectedStandings } from './helpers'

export default function O14NKPhase({ data, locks, myTeam, nkSchedule, onToggle, onSetRound, onPredict, onPredictAll, onPredictSection, onResetSection }) {
  const expected = useMemo(() => getExpectedStandings(data, locks, POULE_ORDER_14), [data, locks])
  if (!nkSchedule) return null

  const slot2t = {}
  for (const id of POULE_ORDER_14) {
    if (!expected[id]) continue
    slot2t[`${id} nr 1`] = expected[id][0]?.team || `${id} nr 1`
    slot2t[`${id} nr 2`] = expected[id][1]?.team || `${id} nr 2`
  }

  const { schedA, schedB, timesA, timesB, poulefaseDate, finaleDate } = nkSchedule

  const nkTeamsA = [], nkTeamsB = []
  for (const id of POULE_ORDER_14) {
    if (!expected[id]) continue
    const [slot1, slot2] = NK14_SLOTS[id]
    const t1 = expected[id][0]?.team, t2 = expected[id][1]?.team
    if (t1) (slot1 === 'A' ? nkTeamsA : nkTeamsB).push(t1)
    if (t2) (slot2 === 'A' ? nkTeamsA : nkTeamsB).push(t2)
  }

  const buildNKRounds = (schedule, times, label) => {
    const rounds = []
    for (let ri = 0; ri < times.length; ri++) {
      const time = times[ri]
      const ms = schedule.filter(m => m.time === time)
      if (!ms.length) continue
      rounds.push({
        pouleId: 'NK' + label, roundNum: ri + 1, date: poulefaseDate || '', time,
        matches: ms.map(m => ({ h: slot2t[m.home] || m.home, a: slot2t[m.away] || m.away, lockKey: `nk_${label}_${m.home}_${m.away}` }))
      })
    }
    return rounds
  }

  const roundsA = buildNKRounds(schedA, timesA, 'A')
  const roundsB = buildNKRounds(schedB, timesB, 'B')

  function calcNKStandings(teams, rounds) {
    const pts = {}
    teams.forEach(t => { pts[t] = 0 })
    for (const round of rounds) {
      for (const m of round.matches) {
        const raw = locks[m.lockKey]
        if (!raw) continue
        const r = typeof raw === 'string' ? raw : raw.result
        if (r === 'W') pts[m.h] = (pts[m.h] || 0) + 3
        else if (r === 'D') { pts[m.h] = (pts[m.h] || 0) + 1; pts[m.a] = (pts[m.a] || 0) + 1 }
        else if (r === 'L') pts[m.a] = (pts[m.a] || 0) + 3
      }
    }
    return [...teams].sort((a, b) => (pts[b] || 0) - (pts[a] || 0))
  }

  const allAFilled = roundsA.every(r => r.matches.every(m => locks[m.lockKey]))
  const allBFilled = roundsB.every(r => r.matches.every(m => locks[m.lockKey]))
  const showHF = allAFilled && allBFilled

  const stA = showHF ? calcNKStandings(nkTeamsA, roundsA) : []
  const stB = showHF ? calcNKStandings(nkTeamsB, roundsB) : []

  const winner = (lockKey, h, a) => { const raw = locks[lockKey]; if (!raw) return null; const r = typeof raw === 'string' ? raw : raw.result; return r === 'W' ? h : r === 'L' ? a : null }
  const hf1h = showHF ? stA[0] : 'NK A nr 1', hf1a = showHF ? stB[1] : 'NK B nr 2'
  const hf2h = showHF ? stB[0] : 'NK B nr 1', hf2a = showHF ? stA[1] : 'NK A nr 2'
  const hfMatches = [{ h: hf1h, a: hf1a, lockKey: 'nk_hf1', isKO: true }, { h: hf2h, a: hf2a, lockKey: 'nk_hf2', isKO: true }]
  const hfTeams = [...new Set(hfMatches.flatMap(m => [m.h, m.a]))]
  const hfRounds = [{ roundNum: 1, date: finaleDate || '', time: '', matches: hfMatches }]

  const hfW1 = winner('nk_hf1', hf1h, hf1a), hfW2 = winner('nk_hf2', hf2h, hf2a)
  const hfL1 = hfW1 ? (hfW1 === hf1h ? hf1a : hf1h) : null
  const hfL2 = hfW2 ? (hfW2 === hf2h ? hf2a : hf2h) : null
  const showFin = hfW1 && hfW2
  const finMatches = [{ h: hfW1 || 'Winnaar HF1', a: hfW2 || 'Winnaar HF2', lockKey: 'nk_finale', isKO: true }]
  const fin34Matches = [{ h: hfL1 || 'Verliezer HF1', a: hfL2 || 'Verliezer HF2', lockKey: 'nk_3e4e', isKO: true }]

  return (
    <div>
      <SectionLabel label="NK Poulefase" onPredict={() => onPredictSection([...roundsA, ...roundsB])} onReset={() => onResetSection([...roundsA, ...roundsB])} />
      <div className="grid-2">
        <SimPouleCard title={`NK Poulefase A${poulefaseDate ? ` · ${poulefaseDate}` : ''}`} headerClass="card-header-a"
          teams={nkTeamsA} basePts={nkTeamsA.map(() => 0)} baseDs={nkTeamsA.map(() => 0)}
          rounds={roundsA} locks={locks} myTeam={myTeam} onToggle={onToggle} onSetRound={onSetRound} onPredict={onPredict}
          onPredictAll={() => onPredictAll(roundsA)} />
        <SimPouleCard title={`NK Poulefase B${poulefaseDate ? ` · ${poulefaseDate}` : ''}`} headerClass="card-header-b"
          teams={nkTeamsB} basePts={nkTeamsB.map(() => 0)} baseDs={nkTeamsB.map(() => 0)}
          rounds={roundsB} locks={locks} myTeam={myTeam} onToggle={onToggle} onSetRound={onSetRound} onPredict={onPredict}
          onPredictAll={() => onPredictAll(roundsB)} />
      </div>
      {showHF && <>
        <SectionLabel label={`NK Halve Finales${finaleDate ? ` · ${finaleDate}` : ''}`} onPredict={() => onPredictSection(hfRounds)} onReset={() => onResetSection(hfRounds)} />
        <SimPouleCard title="Halve Finales" hideStandings teams={hfTeams} basePts={hfTeams.map(() => 0)} baseDs={hfTeams.map(() => 0)}
          rounds={hfRounds} locks={locks} myTeam={myTeam} onToggle={onToggle} onSetRound={onSetRound} onPredict={onSetRound} onPredictAll={() => onPredictAll(hfRounds)} />
      </>}
      {showFin && <>
        <SectionLabel label={`NK Finale 🏆${finaleDate ? ` · ${finaleDate}` : ''}`}
          onPredict={() => onPredictSection([{ matches: [...finMatches, ...fin34Matches] }])} onReset={() => onResetSection([{ matches: [...finMatches, ...fin34Matches] }])} />
        <div className="grid-2">
          <SimPouleCard title="3e/4e plaats" hideStandings teams={[...new Set(fin34Matches.flatMap(m => [m.h, m.a]))]} basePts={[0, 0]} baseDs={[0, 0]}
            rounds={[{ roundNum: 1, date: finaleDate || '', time: '', matches: fin34Matches }]} locks={locks} myTeam={myTeam} onToggle={onToggle} onSetRound={onSetRound} onPredict={onSetRound} onPredictAll={() => {}} />
          <SimPouleCard title="Finale 🏆" hideStandings teams={[...new Set(finMatches.flatMap(m => [m.h, m.a]))]} basePts={[0, 0]} baseDs={[0, 0]}
            rounds={[{ roundNum: 1, date: finaleDate || '', time: '', matches: finMatches }]} locks={locks} myTeam={myTeam} onToggle={onToggle} onSetRound={onSetRound} onPredict={onSetRound} onPredictAll={() => {}} />
        </div>
      </>}
    </div>
  )
}
