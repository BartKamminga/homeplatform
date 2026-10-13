// React-hooks op de engine-brug (engine/store.js). Snapshot max. 10x/s, dus geen re-render per frame.
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

// één waarde uit het snapshot; ververst alleen als die waarde verandert (primitief of stabiele referentie)
export function useVbtValue(selector) {
  return useSyncExternalStore(subSlow, () => selector(snap()))
}

// kalender (actief plan, afgevinkt, FTP): ververst alleen bij een wijziging (calendar.version)
export function useCalendar() {
  useSyncExternalStore(subSlow, () => window.VBT.calendar.version())
  return window.VBT.calendar.getState()
}

// events-ringbuffer: geeft het aantal terug zodat het component bij elk nieuw event ververst
export function useVbtEvents() {
  useSyncExternalStore(cb => store().subscribeEvents(cb), () => store().getEvents().length + ':' + (store().getEvents().at(-1)?.id ?? 0))
  return store().getEvents()
}

export const actions = () => window.VBT.actions

// loopt er een rit in deze toestand (ride / paused / countdown / confirm) - zelfde lijst als de engine
export const isRiding = state => window.VBT.game.isRiding(state)
