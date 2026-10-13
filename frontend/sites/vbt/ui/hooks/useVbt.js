// React-hooks op de engine-brug (game/store.js). Snapshot max. 10x/s, dus geen re-render per frame.
import { useSyncExternalStore } from 'react'

const store = () => window.VBT.store

// Snapshot (of een deel via selector). Standaard 4x/s - genoeg voor panelen en spaart frames;
// { fast: true } = 10x/s (voor de HUD).
const subFast = cb => store().subscribe(cb)
const subSlow = cb => store().subscribeSlow(cb)
const snap = () => store().getSnapshot()

export function useVbt(selector, { fast = false } = {}) {
  const s = useSyncExternalStore(fast ? subFast : subSlow, snap)
  return selector ? selector(s) : s
}

// events-ringbuffer: geeft het aantal terug zodat het component bij elk nieuw event ververst
export function useVbtEvents() {
  useSyncExternalStore(cb => store().subscribeEvents(cb), () => store().getEvents().length + ':' + (store().getEvents().at(-1)?.id ?? 0))
  return store().getEvents()
}

export const actions = () => window.VBT.actions
