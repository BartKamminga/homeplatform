import { useState, useEffect } from 'react'
import { getHockeyPouleSimulation, getHockeyPoulePositionDistribution } from './api.js'

// Los van hooks.js (staat al op 342 regels) - item 963-vervolg: haalt het
// eindpositie-scenario op voor 1 team in 1 poule. Geen cache nodig, elke
// combinatie pid/teamId/targetPosition/fixedOutcomes wordt maar zelden
// herhaald opgevraagd binnen 1 sessie.
//
// item 1033: data blijft bewust staan tijdens een herbevraging (alleen
// `loading` gaat aan) i.p.v. steeds naar null te resetten - dat gaf een
// storende "Laden..."-flits bij elke wat-als-wijziging, terwijl de vorige
// uitkomst nog prima bruikbaar is. `cancelled` voorkomt dat een trage oudere
// request een snellere, nieuwere response alsnog overschrijft.
// fixedOutcomes: { [matchId]: 'H'|'D'|'A' } - "wat als"-aannames (optioneel)
export function useScenario(pid, teamId, targetPosition, fixedOutcomes = {}) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const fixedKey = JSON.stringify(Object.entries(fixedOutcomes).sort())

  useEffect(() => {
    let cancelled = false
    setError(null)
    if (!pid || !teamId || !targetPosition) return
    setLoading(true)
    getHockeyPouleSimulation(pid, teamId, targetPosition, fixedOutcomes)
      .then(d => { if (!cancelled) setData(d) })
      .catch(() => { if (!cancelled) setError('Kon scenario niet berekenen') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [pid, teamId, targetPosition, fixedKey])

  return { data, error, loading }
}

// item 963-vervolg: kans op elke eindpositie tegelijk (1 t/m team_count),
// zelfde "wat als"-aannames als useScenario. Zelfde stale-while-loading-
// gedrag als hierboven (item 1033).
export function usePositionDistribution(pid, teamId, fixedOutcomes = {}) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const fixedKey = JSON.stringify(Object.entries(fixedOutcomes).sort())

  useEffect(() => {
    let cancelled = false
    setError(null)
    if (!pid || !teamId) return
    setLoading(true)
    getHockeyPoulePositionDistribution(pid, teamId, fixedOutcomes)
      .then(d => { if (!cancelled) setData(d) })
      .catch(() => { if (!cancelled) setError('Kon verdeling niet berekenen') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [pid, teamId, fixedKey])

  return { data, error, loading }
}
