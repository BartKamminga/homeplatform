// Status van een wedstrijd-invullinkje, gecombineerd uit opened_at en de
// status van het (eventueel) al ingestuurde verslag. Bij report_type "foto"
// bestaat er geen verslag - daar telt het aantal geuploade fotos/filmpjes
// (photo_count) als "ingevuld" i.p.v. report_status.
export function contributorLinkStatus(link) {
  const expired = new Date(link.expires_at) < new Date()
  if (link.revoked_at) return { label: 'Ingetrokken', color: '#999' }
  if (link.report_type === 'foto') {
    if (link.photo_count > 0) {
      return { label: `Ingevuld · ${link.photo_count} foto's/filmpjes`, color: '#16a34a' }
    }
  } else {
    if (link.report_status === 'published') return { label: 'Ingevuld · gepubliceerd', color: '#16a34a' }
    if (link.report_status === 'concept') return { label: 'Ingevuld · wacht op goedkeuring', color: '#d97706' }
  }
  if (expired) return { label: 'Verlopen', color: '#c23b3b' }
  if (link.opened_at) return { label: 'Geopend, nog niet ingevuld', color: '#0ea5e9' }
  return { label: 'Nog niet geopend', color: '#999' }
}
