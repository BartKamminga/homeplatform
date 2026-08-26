import { useState, useEffect } from 'react'
import { getHockeyPouleSimulation } from './api.js'

// Los van hooks.js (staat al op 342 regels) - item 963-vervolg: haalt het
// eindpositie-scenario op voor 1 team in 1 poule. Geen cache nodig, elke
// combinatie pid/teamId/targetPosition wordt maar zelden herhaald opgevraagd
// binnen 1 sessie.
export function useScenario(pid, teamId, targetPosition) {
  const [data, setData]   = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    setData(null)
    setError(null)
    if (!pid || !teamId || !targetPosition) return
    getHockeyPouleSimulation(pid, teamId, targetPosition)
      .then(setData)
      .catch(() => setError('Kon scenario niet berekenen'))
  }, [pid, teamId, targetPosition])

  return { data, error }
}
