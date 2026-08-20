export function scoreColor(score) {
  if (score >= 8) return 'var(--color-success)'
  if (score >= 4) return 'var(--color-warning)'
  return 'var(--color-danger)'
}

export function scoreLabel(score) {
  if (score >= 8) return 'Uitstekend'
  if (score >= 6) return 'Goed'
  if (score >= 4) return 'Matig'
  return 'Slecht'
}

export function scoreIcon(score) {
  if (score >= 8) return '🟢'
  if (score >= 6) return '🟡'
  if (score >= 4) return '🟠'
  return '🔴'
}
