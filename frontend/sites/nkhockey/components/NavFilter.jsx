// frontend/sites/nkhockey/src/components/NavFilter.jsx
import { useMemo } from 'react'
import { POULE_ORDER_14, POULE_ORDER_16, IS_O16 } from '../constants'

const PHASE_OPTIONS = ['Poules', 'NK Fase', 'Simulaties']

const NK_SUBS_14 = ['NK Poule A', 'NK Poule B']

export default function NavFilter({
  visibleTypes,
  effectiveComp,
  setActiveCompetition,
  selectedPhases,
  setSelectedPhases,
  selectedSubs,
  setSelectedSubs,
  data,
}) {
  const o16 = IS_O16(effectiveComp)
  const pouleOrder = o16 ? POULE_ORDER_16 : POULE_ORDER_14

  const availablePoules = useMemo(() => {
    return pouleOrder.filter(p => data[p])
  }, [data, pouleOrder])

  const availableSubs = useMemo(() => {
    const subs = []
    if (selectedPhases.has('Poules'))  subs.push(...availablePoules)
    if (selectedPhases.has('NK Fase') && !o16) subs.push(...NK_SUBS_14)
    return subs
  }, [selectedPhases, availablePoules, o16])

  function togglePhase(phase) {
    const next = new Set(selectedPhases)
    if (next.has(phase)) {
      next.delete(phase)
      // Verwijder subs die bij deze fase horen
      const phaseSubs = getSubsForPhase(phase)
      const nextSubs = new Set(selectedSubs)
      phaseSubs.forEach(s => nextSubs.delete(s))
      setSelectedSubs(nextSubs)
    } else {
      next.add(phase)
    }
    setSelectedPhases(next)
  }

  function toggleSub(sub) {
    const next = new Set(selectedSubs)
    if (next.has(sub)) next.delete(sub)
    else next.add(sub)
    setSelectedSubs(next)
  }

  function getSubsForPhase(phase) {
    if (phase === 'Poules')  return availablePoules
    if (phase === 'NK Fase') return o16 ? [] : NK_SUBS_14
    return []
  }

  const navStyle = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 12,
  }

  const rowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '7px 12px',
    overflowX: 'auto',
    scrollbarWidth: 'none',
    borderBottom: '1px solid var(--border)',
  }

  const rowStyleLast = { ...rowStyle, borderBottom: 'none' }

  function btnStyle(active) {
    return {
      padding: '4px 11px',
      fontSize: 11,
      fontWeight: 600,
      borderRadius: 20,
      border: active ? '1.5px solid var(--text)' : '1.5px solid transparent',
      background: active ? 'var(--bg-header)' : 'transparent',
      color: active ? 'var(--text)' : 'var(--text-muted)',
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      flexShrink: 0,
      fontFamily: "'DM Sans', sans-serif",
      transition: 'all .12s',
    }
  }

  return (
    <div style={navStyle}>
      {/* Rij 1 — Competitie */}
      <div style={rowStyle}>
        {visibleTypes.map(t => (
          <button key={t} style={btnStyle(effectiveComp === t)}
            onClick={() => {
              setActiveCompetition(t)
              setSelectedPhases(new Set())
              setSelectedSubs(new Set())
            }}>
            {t}
          </button>
        ))}
      </div>

      {/* Rij 2 — Fase */}
      <div style={availableSubs.length > 0 ? rowStyle : rowStyleLast}>
        {PHASE_OPTIONS.map(p => (
          <button key={p} style={btnStyle(selectedPhases.has(p))}
            onClick={() => togglePhase(p)}>
            {p}
          </button>
        ))}
      </div>

      {/* Rij 3 — Subs */}
      {availableSubs.length > 0 && (
        <div style={rowStyleLast}>
          {availableSubs.map(s => (
            <button key={s} style={btnStyle(selectedSubs.has(s))}
              onClick={() => toggleSub(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
