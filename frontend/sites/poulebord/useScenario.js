import { useState, useEffect } from 'react'
import { getHockeyPouleSimulation, getHockeyPoulePositionDistribution } from './api.js'

// item 1040: wacht na de laatste wijziging even (debounce) voordat de
// dure berekening echt wordt opgevraagd - anders vuurt elke score-stepper-
// klik of H/D/A-keuze meteen een eigen request af, en bij snel achter
// elkaar invoeren stapelt dat op terwijl een vorige berekening nog loopt.
const DEBOUNCE_MS = 500

// Gedeelde debounce/stale-while-loading/cancelled-guard-logica (item 1033 +
// 1040) voor useScenario en usePositionDistribution hieronder - scheelt
// duplicatie, het enige verschil tussen de 2 hooks is de fetch-fn en de
// dependency-lijst.
function useDebouncedFetch(enabled, fetchFn, errorMessage, deps) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  useEffect(() => {
    let cancelled = false
    setError(null)
    if (!enabled) return undefined
    setLoading(true)
    const timer = setTimeout(() => {
      fetchFn()
        .then(d => { if (!cancelled) setData(d) })
        .catch(() => { if (!cancelled) setError(errorMessage) })
        .finally(() => { if (!cancelled) setLoading(false) })
    }, DEBOUNCE_MS)
    return () => { cancelled = true; clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, error, loading }
}

// Los van hooks.js (staat al op 342 regels) - item 963-vervolg: haalt het
// eindpositie-scenario op voor 1 team in 1 poule. Geen cache nodig, elke
// combinatie pid/teamId/targetPosition/fixedOutcomes/method wordt maar
// zelden herhaald opgevraagd binnen 1 sessie.
//
// item 1033: data blijft bewust staan tijdens een herbevraging (alleen
// `loading` gaat aan) i.p.v. steeds naar null te resetten - dat gaf een
// storende "Laden..."-flits bij elke wat-als-wijziging, terwijl de vorige
// uitkomst nog prima bruikbaar is.
// fixedOutcomes: { [matchId]: 'H'|'D'|'A' } - "wat als"-aannames (optioneel)
// method: 'auto' (uniform, standaard) of 'poisson' (item 1042 modus-toggle)
export function useScenario(pid, teamId, targetPosition, fixedOutcomes = {}, method = 'auto') {
  const fixedKey = JSON.stringify(Object.entries(fixedOutcomes).sort())
  return useDebouncedFetch(
    !!(pid && teamId && targetPosition),
    () => getHockeyPouleSimulation(pid, teamId, targetPosition, fixedOutcomes, method),
    'Kon scenario niet berekenen',
    [pid, teamId, targetPosition, fixedKey, method],
  )
}

// item 963-vervolg: kans op elke eindpositie tegelijk (1 t/m team_count),
// zelfde "wat als"-aannames als useScenario. Zelfde debounce/stale-while-
// loading-gedrag als hierboven.
export function usePositionDistribution(pid, teamId, fixedOutcomes = {}, method = 'auto') {
  const fixedKey = JSON.stringify(Object.entries(fixedOutcomes).sort())
  return useDebouncedFetch(
    !!(pid && teamId),
    () => getHockeyPoulePositionDistribution(pid, teamId, fixedOutcomes, method),
    'Kon verdeling niet berekenen',
    [pid, teamId, fixedKey, method],
  )
}
