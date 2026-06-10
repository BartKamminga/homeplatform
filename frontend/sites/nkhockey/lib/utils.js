// Pure utility functions — no React
export const pct = (c, N) => Math.round(c / N * 100)
export const pc = (p, hi, mid) => p >= hi ? 'prob-hi' : p >= mid ? 'prob-mid' : 'prob-low'
export function fmtMatchDate(d) { if (!d) return ''; try { return new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }) } catch { return '' } }

// Get last N match results for a team: returns array of 'W'|'D'|'L' (most recent last)
export function getTeamForm(team, matchesPlayed, n = 5) {
  if (!matchesPlayed || !team) return []
  // Sort by round descending, take matches involving team
  const teamMatches = matchesPlayed
    .filter(m => m.home === team || m.away === team)
    .sort((a, b) => (parseInt(a.round) || 0) - (parseInt(b.round) || 0))
  const results = teamMatches.map(m => {
    const [sh, sa] = (m.score || '').split('-').map(Number)
    if (isNaN(sh) || isNaN(sa)) return null
    if (m.home === team) return sh > sa ? 'W' : sh === sa ? 'D' : 'L'
    return sa > sh ? 'W' : sh === sa ? 'D' : 'L'
  }).filter(Boolean)
  return results.slice(-n)
}
