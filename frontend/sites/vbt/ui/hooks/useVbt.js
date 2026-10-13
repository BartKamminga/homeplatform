// React-hooks op de engine-brug (game/store.js). Snapshot max. 10x/s, dus geen re-render per frame.
import { useSyncExternalStore } from 'react'

const store = () => window.VBT.store

// volledige snapshot (of een deel via selector; houd selectors primitief of memo ze zelf)
export function useVbt(selector) {
  const snap = useSyncExternalStore(cb => store().subscribe(cb), () => store().getSnapshot())
  return selector ? selector(snap) : snap
}

// events-ringbuffer: geeft het aantal terug zodat het component bij elk nieuw event ververst
export function useVbtEvents() {
  useSyncExternalStore(cb => store().subscribeEvents(cb), () => store().getEvents().length + ':' + (store().getEvents().at(-1)?.id ?? 0))
  return store().getEvents()
}

export const actions = () => window.VBT.actions
