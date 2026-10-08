// Seintje "er is iets opgeslagen" (item 1239): api.js roept notifyDataChanged
// aan na elke geslaagde schrijfactie; de beheerstudio luistert en ververst de
// preview. Bewust een simpel window-event, geen gedeelde store.
const EVENT = 'yof:data-changed'

export function notifyDataChanged() {
  window.dispatchEvent(new Event(EVENT))
}

export function onDataChanged(handler) {
  window.addEventListener(EVENT, handler)
  return () => window.removeEventListener(EVENT, handler)
}
