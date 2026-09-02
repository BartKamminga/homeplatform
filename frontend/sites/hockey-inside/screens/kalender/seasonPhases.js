// item 1043: seizoensfases (veld najaar / zaal / veld voorjaar), geleverd
// door GET /api/hockey/vanger/scan-calendar als `season_phases` - gedeeld
// tussen Jaar/Maand/Week/Dag-view zodat de kleur-encodering overal gelijk is.
export const PHASE_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#4a3aa7']

export function phaseForDate(phases, date) {
  return (phases || []).find(p => date >= new Date(p.start) && date <= new Date(p.end))
}

export function phaseColor(phases, phase) {
  if (!phase) return 'var(--color-border)'
  return PHASE_COLORS[phases.indexOf(phase) % PHASE_COLORS.length]
}

export function phasesInRange(phases, from, to) {
  const result = []
  for (const p of (phases || [])) {
    if (new Date(p.start) <= to && new Date(p.end) >= from && !result.includes(p)) result.push(p)
  }
  return result
}
