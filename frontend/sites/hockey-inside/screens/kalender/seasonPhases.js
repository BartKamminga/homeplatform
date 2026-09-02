// item 1043: seizoensfases (veld najaar / zaal / veld voorjaar), geleverd
// door GET /api/hockey/vanger/scan-calendar als `season_phases` - gedeeld
// tussen Jaar/Maand/Week/Dag-view zodat de kleur-encodering overal gelijk is.
export const PHASE_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#4a3aa7']

export function phaseForDate(phases, date) {
  return (phases || []).find(p => date >= new Date(p.start) && date <= new Date(p.end))
}

// Fase-overgangen vallen zelden precies op de 1e van de maand (bv. zaal
// loopt tot 14 feb, voorjaar begint pas 6 mrt) - phaseForDate op enkel de
// 1e dag van de maand liet dan onterecht een "gat" zien voor elke maand
// waarvan dag 1 net in zo'n overgang valt (aug/dec/mrt). Deze functie kiest
// i.p.v. daarvan de fase die het GROOTSTE deel van de maand beslaat.
export function phaseForMonth(phases, monthDate) {
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
  const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)
  let best = null
  let bestOverlapDays = 0
  for (const p of (phases || [])) {
    const overlapStart = new Date(Math.max(monthStart, new Date(p.start)))
    const overlapEnd = new Date(Math.min(monthEnd, new Date(p.end)))
    const overlapDays = (overlapEnd - overlapStart) / 86400000
    if (overlapDays > bestOverlapDays) {
      bestOverlapDays = overlapDays
      best = p
    }
  }
  return best
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

// data.season_calendar_events (uit hockey_season_calendar) - start/eind van
// elke fase per district/leeftijdscategorie, los van de landelijk-gemiddelde
// band uit season_phases. dateStr moet lokaal (y-m-d) zijn, niet toISOString.
export function eventsOnDate(events, dateStr) {
  return (events || []).filter(e => e.date === dateStr)
}
