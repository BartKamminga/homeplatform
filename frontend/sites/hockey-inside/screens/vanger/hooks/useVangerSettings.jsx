import { useState, useEffect } from 'react'
import { api } from '@core/api.js'

// Uitgesplitst uit useVangerState.jsx (RFTR-B6, item 989).
// flash: melding-functie uit useCmdQueue (zelfde toast-plek als de rest).
export function useVangerSettings(flash) {
  const [vangerSettings, setVangerSettings] = useState(null)

  function loadVangerSettings() { api.get('/api/hockey/vanger/settings').then(setVangerSettings).catch(() => {}) }

  function saveVangerSettings(patch) {
    api.post('/api/hockey/vanger/settings', patch)
      .then(setVangerSettings)
      .then(() => flash('Idle-timeout opgeslagen'))
      .catch(() => flash('Opslaan mislukt'))
  }

  useEffect(() => { loadVangerSettings() }, [])

  return { vangerSettings, saveVangerSettings }
}
