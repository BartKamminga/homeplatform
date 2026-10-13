// body[data-state] en body-klassen vanuit het snapshot: de CSS toont/verbergt daarmee titel, aftellen, pauze,
// stopvraag, finish en HUD-panelen (workout, drafting, off-<onderdeel> uit de weergave-instellingen).
import { useEffect } from 'react'
import { useVbt } from './useVbt.js'

export default function useBodyState() {
  const s = useVbt(null, { fast: true })
  const workout = !!s.workout, drafting = !!s.drafting
  const keys = window.VBT.settings.DISPLAY_KEYS
  const off = s.settings ? keys.filter(k => s.settings[k] === false).join(',') : ''
  useEffect(() => { document.body.dataset.state = s.state }, [s.state])
  useEffect(() => { document.body.classList.toggle('workout', workout) }, [workout])
  useEffect(() => { document.body.classList.toggle('drafting', drafting) }, [drafting])
  useEffect(() => {
    const set = new Set(off.split(','))
    keys.forEach(k => document.body.classList.toggle('off-' + k, set.has(k)))
  }, [off])
}
