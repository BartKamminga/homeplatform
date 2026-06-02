import React, { useMemo } from 'react'
import { POULE_ORDER_16 } from '../../constants'
import SimPouleCard from './SimPouleCard'
import SectionLabel from './SectionLabel'
import { getExpectedStandings } from './helpers'

export default function O16KFPhase({ data, locks, myTeam, onToggle, onSetRound, onPredictAll, onPredictSection, onResetSection }) {
  const expected = useMemo(() => getExpectedStandings(data, locks, POULE_ORDER_16), [data, locks])
  const pk = POULE_ORDER_16.filter(id => expected[id])
  if (pk.length < 4) return null

  const nr1s = pk.map(k => ({ team: expected[k][0]?.team, poule: k, pts: expected[k][0]?.newPts || 0, ds: expected[k][0]?.ds || 0 }))
    .sort((a, b) => b.pts !== a.pts ? b.pts - a.pts : b.ds - a.ds)
  const nr2s = pk.map(k => ({ team: expected[k][1]?.team, poule: k, pts: expected[k][1]?.newPts || 0, ds: expected[k][1]?.ds || 0 }))
    .sort((a, b) => b.pts !== a.pts ? b.pts - a.pts : b.ds - a.ds)

  const kf = [
    { h: nr1s[0].team, a: nr2s[3].team, lockKey: 'nk_kf1', isKO: true },
    { h: nr1s[1].team, a: nr2s[2].team, lockKey: 'nk_kf2', isKO: true },
    { h: nr1s[2].team, a: nr2s[1].team, lockKey: 'nk_kf3', isKO: true },
    { h: nr1s[3].team, a: nr2s[0].team, lockKey: 'nk_kf4', isKO: true },
  ]
  const kfTeams = [...new Set(kf.flatMap(m => [m.h, m.a]))]
  const kfRounds = [{ roundNum: 1, date: '', time: '', matches: kf }]

  const winner = (lockKey, h, a) => { const raw = locks[lockKey]; if (!raw) return null; const r = typeof raw === 'string' ? raw : raw.result; return r === 'W' ? h : r === 'L' ? a : null }
  const kfW1 = winner('nk_kf1', kf[0].h, kf[0].a), kfW2 = winner('nk_kf2', kf[1].h, kf[1].a)
  const kfW3 = winner('nk_kf3', kf[2].h, kf[2].a), kfW4 = winner('nk_kf4', kf[3].h, kf[3].a)

  const hf1h = kfW1 || 'Winnaar KF1', hf1a = kfW4 || 'Winnaar KF4'
  const hf2h = kfW2 || 'Winnaar KF2', hf2a = kfW3 || 'Winnaar KF3'
  const hfMatches = [{ h: hf1h, a: hf1a, lockKey: 'nk_hf1', isKO: true }, { h: hf2h, a: hf2a, lockKey: 'nk_hf2', isKO: true }]
  const hfTeams = [...new Set(hfMatches.flatMap(m => [m.h, m.a]))]
  const hfRounds = [{ roundNum: 1, date: '', time: '', matches: hfMatches }]
  const showHF = kfW1 && kfW2 && kfW3 && kfW4

  const hfW1 = winner('nk_hf1', hf1h, hf1a), hfW2 = winner('nk_hf2', hf2h, hf2a)
  const finH = hfW1 || 'Winnaar HF1', finA = hfW2 || 'Winnaar HF2'
  const finMatches = [{ h: finH, a: finA, lockKey: 'nk_finale', isKO: true }]
  const finTeams = [...new Set(finMatches.flatMap(m => [m.h, m.a]))]
  const finRounds = [{ roundNum: 1, date: '', time: '', matches: finMatches }]
  const showFin = hfW1 && hfW2

  return (
    <div>
      <SectionLabel label="NK Kwartfinales" onPredict={() => onPredictSection(kfRounds)} onReset={() => onResetSection(kfRounds)} />
      <SimPouleCard title="Kwartfinales" hideStandings teams={kfTeams} basePts={kfTeams.map(() => 0)} baseDs={kfTeams.map(() => 0)}
        rounds={kfRounds} locks={locks} myTeam={myTeam} onToggle={onToggle} onSetRound={onSetRound} onPredict={onSetRound} onPredictAll={() => onPredictAll(kfRounds)} />
      {showHF && <>
        <SectionLabel label="NK Halve Finales" onPredict={() => onPredictSection(hfRounds)} onReset={() => onResetSection(hfRounds)} />
        <SimPouleCard title="Halve Finales" hideStandings teams={hfTeams} basePts={hfTeams.map(() => 0)} baseDs={hfTeams.map(() => 0)}
          rounds={hfRounds} locks={locks} myTeam={myTeam} onToggle={onToggle} onSetRound={onSetRound} onPredict={onSetRound} onPredictAll={() => onPredictAll(hfRounds)} />
      </>}
      {showFin && <>
        <SectionLabel label="NK Finale 🏆" onPredict={() => onPredictSection(finRounds)} onReset={() => onResetSection(finRounds)} />
        <SimPouleCard title="Finale" hideStandings teams={finTeams} basePts={finTeams.map(() => 0)} baseDs={finTeams.map(() => 0)}
          rounds={finRounds} locks={locks} myTeam={myTeam} onToggle={onToggle} onSetRound={onSetRound} onPredict={onSetRound} onPredictAll={() => onPredictAll(finRounds)} />
      </>}
    </div>
  )
}
