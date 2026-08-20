export function scoreColorVar(score) {
  if (score >= 8) return '--color-success'
  if (score >= 4) return '--color-warning'
  return '--color-danger'
}

export function scoreColor(score) {
  return `var(${scoreColorVar(score)})`
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
