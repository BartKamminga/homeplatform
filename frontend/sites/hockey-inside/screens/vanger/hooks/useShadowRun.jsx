import { useState, useEffect, useRef } from 'react'
import { shadowRunScanPlan } from '../../../api.js'

// item 1084: debounce + request-id-guard rond shadow-run - zwaarder dan
// preview-scenario (volledige build_schedule_events-aanroep op
// productieschaal), dus zwaarder gedebounced (700ms) zodat snel typen geen
// burst van dure requests geeft.
export function useShadowRun(settings, queueFilter, horizonDays = 14) {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const requestIdRef = useRef(0)
  const settingsKey = JSON.stringify(settings)
  const filterKey = JSON.stringify(queueFilter)

  useEffect(() => {
    const requestId = ++requestIdRef.current
    const t = setTimeout(() => {
      setLoading(true)
      const filter = JSON.parse(filterKey)
      shadowRunScanPlan({
        settings: JSON.parse(settingsKey),
        age_groups: filter.age_groups, club_external_id: filter.club_external_id,
        categories: filter.categories, hockey_types: filter.hockey_types, genders: filter.genders,
        horizon_days: horizonDays,
      })
        .then(d => {
          if (requestIdRef.current !== requestId) return
          setResult(d)
          setError('')
        })
        .catch(e => {
          if (requestIdRef.current !== requestId) return
          setError(e.message || 'Shadow-run mislukt')
        })
        .finally(() => {
          if (requestIdRef.current === requestId) setLoading(false)
        })
    }, 700)
    return () => clearTimeout(t)
  }, [settingsKey, filterKey, horizonDays])

  return { result, loading, error }
}
