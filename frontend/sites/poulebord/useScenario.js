import { useState, useEffect } from 'react'
import { getHockeyPouleSimulation, getHockeyPoulePositionDistribution } from './api.js'

// Los van hooks.js (staat al op 342 regels) - item 963-vervolg: haalt het
// eindpositie-scenario op voor 1 team in 1 poule. Geen cache nodig, elke
// combinatie pid/teamId/targetPosition/fixedOutcomes wordt maar zelden
// herhaald opgevraagd binnen 1 sessie.
// fixedOutcomes: { [matchId]: 'H'|'D'|'A' } - "wat als"-aannames (optioneel)
export function useScenario(pid, teamId, targetPosition, fixedOutcomes = {}) {
  const [data, setData]   = useState(null)
  const [error, setError] = useState(null)
  const fixedKey = JSON.stringify(Object.entries(fixedOutcomes).sort())

  useEffect(() => {
    setData(null)
    setError(null)
    if (!pid || !teamId || !targetPosition) return
    getHockeyPouleSimulation(pid, teamId, targetPosition, fixedOutcomes)
      .then(setData)
      .catch(() => setError('Kon scenario niet berekenen'))
  }, [pid, teamId, targetPosition, fixedKey])

  return { data, error }
}

// item 963-vervolg: kans op elke eindpositie tegelijk (1 t/m team_count),
// zelfde "wat als"-aannames als useScenario.
export function usePositionDistribution(pid, teamId, fixedOutcomes = {}) {
  const [data, setData]   = useState(null)
  const [error, setError] = useState(null)
  const fixedKey = JSON.stringify(Object.entries(fixedOutcomes).sort())

  useEffect(() => {
    setData(null)
    setError(null)
    if (!pid || !teamId) return
    getHockeyPoulePositionDistribution(pid, teamId, fixedOutcomes)
      .then(setData)
      .catch(() => setError('Kon verdeling niet berekenen'))
  }, [pid, teamId, fixedKey])

  return { data, error }
}
