import { useState, useEffect } from 'react'
import { api } from '@core/api.js'

// Uitgesplitst uit useVangerState.jsx (RFTR-B6, item 989).
export function usePluginErrors() {
  const [pluginErrors, setPluginErrors] = useState([])

  useEffect(() => {
    api.get('/api/hockey/plugin-errors?limit=30').then(r => setPluginErrors(r.errors || [])).catch(() => {})
  }, [])

  return { pluginErrors, setPluginErrors }
}
