import { useState, useEffect } from 'react'

// Gedeelde instellingen-formulier-boilerplate (RFTR-B6, item 989, fase 6.5) -
// VangerTuning en ScanPlanTuning (VangerStatusCard.jsx) hadden identieke
// load/set/save-logica, alleen met een andere fieldKeys-lijst.
export function useSettingsForm(settings, fieldKeys, onSave) {
  const [values, setValues] = useState({})

  useEffect(() => {
    if (!settings) return
    const next = {}
    for (const key of fieldKeys) next[key] = String(settings[key] ?? '')
    setValues(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings])

  function set(key, v) { setValues(prev => ({ ...prev, [key]: v })) }

  function save() {
    const patch = {}
    for (const key of Object.keys(values)) patch[key] = Number(values[key]) || settings[key]
    onSave(patch)
  }

  return { values, set, save }
}
