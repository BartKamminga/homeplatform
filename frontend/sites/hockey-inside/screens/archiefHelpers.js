// Zuivere helpers voor het Archief, losgetrokken uit ArchiefTab.jsx (item 737).

export function captureLabel(captureType) {
  if (captureType === 'poule_capture') return 'Poule capture'
  if (captureType === 'club_detail')   return 'Club detail'
  if (captureType === 'comp_detail')   return 'Competitie detail'
  if (captureType === 'clubs_list')    return 'Clubs lijst'
  if (captureType === 'comp_list')     return 'Competities lijst'
  return 'Capture'
}

export function fmt(iso) {
  if (!iso) return '?'
  return new Date(iso).toLocaleString('nl-NL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
