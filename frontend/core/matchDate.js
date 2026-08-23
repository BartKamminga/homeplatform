// Wedstrijddatum/-tijd formatteren. Sommige bronnen (hockey.nl-discovery) kennen
// de aanvangstijd nog niet en zetten dan match_date op middernacht als placeholder —
// die tonen we als "(nnb)" i.p.v. een misleidend "00:00".

function isKnownTime(d) {
  return !isNaN(d.getTime()) && !(d.getHours() === 0 && d.getMinutes() === 0)
}

export function formatMatchTime(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (!isKnownTime(d)) return 'nnb'
  return d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}

export function formatMatchDateTime(iso) {
  if (!iso) return null
  const datePart = iso.slice(0, 10)
  return `${datePart} (${formatMatchTime(iso)})`
}

export function formatMatchDay(iso) {
  if (!iso) return null
  const datePart = iso.slice(0, 10)
  const d = new Date(`${datePart}T12:00:00Z`) // anker op het middaguur UTC, voorkomt dag-verschuiving door tijdzone
  if (isNaN(d.getTime())) return datePart
  return d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function matchDayKey(iso) {
  return iso ? iso.slice(0, 10) : '_onbekend'
}
