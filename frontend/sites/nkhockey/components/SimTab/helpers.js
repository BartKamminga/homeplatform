import { POULE_ORDER_14, POULE_ORDER_16 } from '../../constants'

// Build simLocks from UI locks (home perspective, no transformation needed)
export function buildAllSimLocks(uiLocks) {
  const simLocks = {}
  for (const [key, val] of Object.entries(uiLocks)) {
    if (val) simLocks[key] = val
  }
  return simLocks
}

// Calculate expected standings per poule with locks applied
export function getExpectedStandings(data, locks, pouleOrder) {
  const result = {}
  for (const pouleId of pouleOrder) {
    const poule = data[pouleId]
    if (!poule) continue
    const adjusted = poule.teams.map((team, i) => ({
      team, pts: poule.pts[i], ds: poule.ds[i], delta: 0, dsDelta: 0, origRank: i
    }))
    for (const [h, a] of poule.remaining) {
      const raw = locks[`${h}_${a}`]
      if (!raw) continue
      const lock = typeof raw === 'string' ? { result: raw } : raw
      const hi = poule.teams.indexOf(h), ai = poule.teams.indexOf(a)
      if (hi < 0 || ai < 0) continue
      if (lock.result === 'W') { adjusted[hi].delta += 3 }
      else if (lock.result === 'D') { adjusted[hi].delta += 1; adjusted[ai].delta += 1 }
      else if (lock.result === 'L') { adjusted[ai].delta += 3 }
      // DS from scores if available
      if (lock.scoreH != null && lock.scoreA != null) {
        adjusted[hi].dsDelta += lock.scoreH - lock.scoreA
        adjusted[ai].dsDelta += lock.scoreA - lock.scoreH
      }
    }
    adjusted.forEach(s => { s.newPts = s.pts + s.delta; s.newDs = s.ds + s.dsDelta })
    adjusted.sort((a, b) => b.newPts !== a.newPts ? b.newPts - a.newPts : b.newDs !== a.newDs ? b.newDs - a.newDs : a.origRank - b.origRank)
    result[pouleId] = adjusted
  }
  return result
}
