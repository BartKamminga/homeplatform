export function scoreColorVar(score) {
  if (score >= 8) return '--color-success'
  if (score >= 4) return '--color-warning'
  return '--color-danger'
}

export function scoreColor(score) {
  return `var(${scoreColorVar(score)})`
}

export function scoreIcon(score) {
  if (score >= 8) return '🟢'
  if (score >= 6) return '🟡'
  if (score >= 4) return '🟠'
  return '🔴'
}
