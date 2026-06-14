export function resolveTeam(teamId, sourceId, takes, teamMap, matchMap) {
  if (teamId) return teamMap[teamId] ?? null
  if (!sourceId) return null
  const src = matchMap?.[sourceId]
  if (!src) return null
  const label = takes === 'loser' ? 'Verl.' : 'Win.'
  const tA = src.team_a_id ? (teamMap[src.team_a_id]?.name ?? '?') : '?'
  const tB = src.team_b_id ? (teamMap[src.team_b_id]?.name ?? '?') : '?'
  return { name: `${label} ${tA}–${tB}`, is_placeholder: true }
}
