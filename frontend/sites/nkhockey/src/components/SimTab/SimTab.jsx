import React, { useState, useEffect, useMemo } from 'react'
import { POULE_ORDER_14, POULE_ORDER_16, IS_O16 } from '../../constants'
import { NK_SCHEDULES } from '../../lib/nk-schedules'
import { runSimO14, runSimO16, predictMatches, generateScore } from './simulation'
import { buildAllSimLocks } from './helpers'
import RemainingPouleCards from './RemainingPouleCards'
import O14NKPhase from './O14NKPhase'
import O16KFPhase from './O16KFPhase'
import NKChances from './NKChances'

export default function SimTab({ data, myTeam, effectiveComp, focusMode, showForm, showPlayed, showMatches, simCount, selectedPhases = new Set(), selectedSubs = new Set() }) {
  const o16 = IS_O16(effectiveComp)
  const pouleOrder = o16 ? POULE_ORDER_16 : POULE_ORDER_14
  const N = simCount || 15000

  const myPouleId = useMemo(() => {
    if (!myTeam) return null
    for (const id of pouleOrder) {
      if (data[id] && data[id].teams.indexOf(myTeam) >= 0) return id
    }
    return null
  }, [data, myTeam, pouleOrder])

  const [locks, setLocks] = useState({})
  const [results, setResults] = useState(null)
  const [baseResults, setBaseResults] = useState(null)
  const [running, setRunning] = useState(false)
  const [simNote, setSimNote] = useState('')

  const hasLocks = Object.keys(locks).length > 0

  // ── Zichtbaarheid ──
  const nothingSelected = selectedPhases.size === 0
  const simMode    = selectedPhases.has('Simulaties')
  const showPoules = nothingSelected || selectedPhases.has('Poules')
  const showNKFase = nothingSelected || selectedPhases.has('NK Fase')
  const showKansen = simMode

  // ── Interactief alleen als Simulaties aan ──
  const interactive = simMode

  // ── Poule IDs ──
  const timelinePouleIds = useMemo(() => {
    const all = pouleOrder.filter(id => data[id])
    if (focusMode && myPouleId && nothingSelected) return [myPouleId]
    if (!showPoules) return []
    if (selectedSubs.size > 0) {
      const pouleSubs = [...selectedSubs].filter(s => !s.startsWith('NK'))
      if (pouleSubs.length > 0) return all.filter(id => pouleSubs.includes(id))
    }
    return all
  }, [pouleOrder, data, focusMode, myPouleId, nothingSelected, showPoules, selectedSubs])

  // ── NK sub selectie voor O14 ──
  const selectedNKSubs = useMemo(() => {
    if (!selectedPhases.has('NK Fase')) return new Set()
    const nkSubs = new Set()
    selectedSubs.forEach(s => { if (s.startsWith('NK Poule')) nkSubs.add(s) })
    return nkSubs
  }, [selectedPhases, selectedSubs])

  function doSim(currentLocks) {
    const simLocks = buildAllSimLocks(currentLocks || locks)
    setRunning(true)
    setTimeout(() => {
      const nkSched = o16 ? null : NK_SCHEDULES[effectiveComp]
      const r = o16 ? runSimO16(data, N, 0, simLocks) : runSimO14(data, N, 0, simLocks, nkSched)
      setResults(r)
      setSimNote(`${N.toLocaleString('nl-NL')} sim · ${new Date().toLocaleString('nl-NL')}`)
      setRunning(false)
    }, 20)
  }

  useEffect(() => {
    const nkSched = o16 ? null : NK_SCHEDULES[effectiveComp]
    const base = o16 ? runSimO16(data, N, 0) : runSimO14(data, N, 0, null, nkSched)
    setBaseResults(base)
    setResults(base)
    setSimNote(`${N.toLocaleString('nl-NL')} sim · ${new Date().toLocaleString('nl-NL')}`)
  }, [])

  function onToggle(lockKey, outcome) {
    const newLocks = { ...locks }
    if (outcome === null) {
      delete newLocks[lockKey]
    } else {
      const cur = newLocks[lockKey]
      const curResult = cur ? (typeof cur === 'string' ? cur : cur.result) : null
      if (curResult === outcome) delete newLocks[lockKey]
      else {
        const [scoreH, scoreA] = generateScore(outcome)
        newLocks[lockKey] = { result: outcome, scoreH, scoreA }
      }
    }
    setLocks(newLocks)
    doSim(newLocks)
  }

  function onSetRound(round, outcome) {
    const newLocks = { ...locks }
    for (const m of round.matches) {
      if (outcome === null) delete newLocks[m.lockKey]
      else {
        const [scoreH, scoreA] = generateScore(outcome)
        newLocks[m.lockKey] = { result: outcome, scoreH, scoreA }
      }
    }
    setLocks(newLocks)
    doSim(newLocks)
  }

  function onPredict(round) {
    const poule = data[round.pouleId]
    if (!poule) return
    const predicted = predictMatches(round.matches, poule)
    const newLocks = { ...locks }
    for (const [key, val] of Object.entries(predicted)) { if (val) newLocks[key] = val }
    setLocks(newLocks)
    doSim(newLocks)
  }

  function onPredictAllRounds(rounds, poule) {
    const newLocks = { ...locks }
    for (const round of rounds) {
      const unlocked = round.matches.filter(m => !newLocks[m.lockKey])
      if (unlocked.length === 0) continue
      const predicted = predictMatches(unlocked, poule)
      for (const [key, val] of Object.entries(predicted)) { if (val) newLocks[key] = val }
    }
    setLocks(newLocks)
    doSim(newLocks)
  }

  function onPredictNK(rounds) {
    const newLocks = { ...locks }
    for (const round of (Array.isArray(rounds) ? rounds : [rounds])) {
      for (const m of round.matches) {
        if (newLocks[m.lockKey]) continue
        const result = m.isKO ? (Math.random() < 0.5 ? 'W' : 'L') : (() => { const r = Math.random(); return r < 0.4 ? 'W' : r < 0.65 ? 'D' : 'L' })()
        const [scoreH, scoreA] = generateScore(result)
        newLocks[m.lockKey] = { result, scoreH, scoreA }
      }
    }
    setLocks(newLocks)
    doSim(newLocks)
  }

  function onPredictSectionPoules() {
    const newLocks = { ...locks }
    for (const pouleId of timelinePouleIds) {
      const poule = data[pouleId]
      if (!poule) continue
      const allMatches = poule.remaining.map(([h, a]) => ({ h, a, lockKey: `${h}_${a}` }))
      const unlocked = allMatches.filter(m => !newLocks[m.lockKey])
      if (unlocked.length === 0) continue
      const predicted = predictMatches(unlocked, poule)
      for (const [key, val] of Object.entries(predicted)) { if (val) newLocks[key] = val }
    }
    setLocks(newLocks)
    doSim(newLocks)
  }

  function onResetSectionRounds(rounds) {
    const newLocks = { ...locks }
    for (const round of rounds) { for (const m of round.matches) delete newLocks[m.lockKey] }
    setLocks(newLocks)
    doSim(newLocks)
  }

  function onResetPoules() {
    const newLocks = { ...locks }
    for (const pouleId of timelinePouleIds) {
      const poule = data[pouleId]
      if (!poule) continue
      for (const [h, a] of poule.remaining) delete newLocks[`${h}_${a}`]
    }
    setLocks(newLocks)
    doSim(newLocks)
  }

  return (
    <div>
      {showPoules && timelinePouleIds.length > 0 && (
        <RemainingPouleCards
          data={data} showForm={showForm} showPlayed={showPlayed} showMatches={showMatches}
          pouleIds={timelinePouleIds} myTeam={myTeam} locks={locks}
          onToggle={onToggle} onSetRound={onSetRound} onPredict={onPredict}
          onPredictAllRounds={onPredictAllRounds}
          onPredictSection={onPredictSectionPoules} onResetSection={onResetPoules}
          interactive={interactive}
        />
      )}

      {showNKFase && !o16 && (
        <O14NKPhase
          data={data} locks={locks} myTeam={myTeam}
          nkSchedule={NK_SCHEDULES[effectiveComp]}
          onToggle={onToggle} onSetRound={onSetRound}
          onPredict={r => onPredictNK([r])} onPredictAll={onPredictNK}
          onPredictSection={onPredictNK} onResetSection={onResetSectionRounds}
          selectedNKSubs={selectedNKSubs}
          showAllNKPhases={selectedPhases.has('NK Fase')}
          interactive={interactive}
        />
      )}

      {showNKFase && o16 && (
        <O16KFPhase
          data={data} locks={locks} myTeam={myTeam}
          onToggle={onToggle} onSetRound={onSetRound} onPredictAll={onPredictNK}
          onPredictSection={onPredictNK} onResetSection={onResetSectionRounds}
          showAllNKPhases={selectedPhases.has('NK Fase')}
          interactive={interactive}
        />
      )}

      {showKansen && (
        <>
          <NKChances myTeam={myTeam} results={results} baseResults={baseResults} N={N} o16={o16} hasLocks={hasLocks} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <button className="run-btn" onClick={() => doSim()} disabled={running} style={{ marginLeft: 0 }}>
              {running ? 'Bezig...' : `Herbereken (${N.toLocaleString('nl-NL')})`}
            </button>
          </div>
          {simNote && <div className="sim-note">{simNote}</div>}
        </>
      )}
    </div>
  )
}
