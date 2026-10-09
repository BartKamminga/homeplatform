// Spelerskaart in FIFA-stijl - vaste waarden en kleine helpers.
export const STAT_KEYS = ['SNE', 'TEC', 'PAS', 'SCH', 'VER', 'FYS']
export const STAT_LABELS = { SNE: 'Snelheid', TEC: 'Techniek', PAS: 'Passen', SCH: 'Schieten', VER: 'Verdedigen', FYS: 'Fysiek' }
export const CARD_STYLES = [
  { value: 'goud', label: 'Victoria goud' },
  { value: 'nacht', label: 'Victoria nacht' },
  { value: 'paris', label: 'Paris' },
]

// Positie uit het profiel -> afkorting linksboven
export function positionCode(player) {
  if (player.role_title) return player.role_title.slice(0, 5).toUpperCase()
  const p = (player.position || '').toLowerCase()
  if (p.startsWith('keep')) return 'KEEP'
  if (p.startsWith('voor') || p.startsWith('aan')) return 'AAN'
  if (p.startsWith('mid')) return 'MID'
  if (p.startsWith('acht') || p.startsWith('verd')) return 'ACH'
  return ''
}
