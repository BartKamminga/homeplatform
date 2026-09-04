import { useState, useEffect, useRef } from 'react'
import { previewScanPlanScenario } from '../../../api.js'

// item 1084: debounce + request-id-guard rond preview-scenario ("laatste
// aanvraag wint" i.p.v. "laatst binnengekomen antwoord wint" - zelfde
// patroon als ScheduleDebugPanel.jsx). Licht gedebounced (200ms) - de
// backend-call zelf is snel (1 gefabriceerd object, geen DB-scan).
export function useScanPlanPreview(scope, scenario, settings) {
  const [rows, setRows] = useState([])
  const [now, setNow] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const requestIdRef = useRef(0)
  const settingsKey = JSON.stringify(settings)

  useEffect(() => {
    const requestId = ++requestIdRef.current
    const t = setTimeout(() => {
      setLoading(true)
      previewScanPlanScenario({ scope, scenario, settings: JSON.parse(settingsKey) })
        .then(d => {
          if (requestIdRef.current !== requestId) return
          setRows(d.rows || [])
          setNow(d.now || null)
          setError('')
        })
        .catch(e => {
          if (requestIdRef.current !== requestId) return
          setError(e.message || 'Preview mislukt')
        })
        .finally(() => {
          if (requestIdRef.current === requestId) setLoading(false)
        })
    }, 200)
    return () => clearTimeout(t)
  }, [scope, scenario, settingsKey])

  return { rows, now, loading, error }
}
