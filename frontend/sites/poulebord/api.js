import { api } from '../../core/api.js'

export const getDiscoverySeason     = ()    => api.get('/api/hockey/public/season')
export const getHockeyPublications  = ()    => api.get('/api/hockey/public/publications')
export const getPhases         = (tid) => api.get(`/api/tournix/public/tournaments/${tid}/phases`)
export const getPhaseStandings = (pid) => api.get(`/api/tournix/public/phases/${pid}/standings`)
export const saveBoard         = (body) => api.post('/api/tournix/public/boards', body)
export const getBoardByCode    = (code) => api.get(`/api/tournix/public/boards/${code}`)
export const getPoolMatches    = (phaseId, poolName) =>
  api.get(`/api/tournix/public/phases/${phaseId}/pool-matches?pool=${encodeURIComponent(poolName)}`)
export const searchDiscoveryPools = (q) =>
  api.get(`/api/hockey/public/search?q=${encodeURIComponent(q)}`)
export const getTournamentCompetitionStandings = (tid) =>
  api.get(`/api/hockey/public/tournaments/${tid}/competition-standings`)
export const getHockeyPouleStandings = (pid) =>
  api.get(`/api/hockey/public/hockey-poules/${pid}/standings`)
export const getHockeyPouleMatches = (pid) =>
  api.get(`/api/hockey/public/hockey-poules/${pid}/matches`)
// fixedOutcomes-waarde: 'H'|'D'|'A' (item 963) of { outcome: 'H'|'D'|'A', score: [thuis, uit] | null } (item 1034).
function withFixedOutcomes(params, fixedOutcomes = {}) {
  for (const [matchId, v] of Object.entries(fixedOutcomes)) {
    const outcome = typeof v === 'string' ? v : v.outcome
    const score = typeof v === 'string' ? null : v.score
    params.append('fixed', score ? `${matchId}:${outcome}:${score[0]}:${score[1]}` : `${matchId}:${outcome}`)
  }
  return params
}
export const getHockeyPouleSimulation = (pid, teamId, targetPosition, fixedOutcomes = {}) => {
  const params = withFixedOutcomes(new URLSearchParams({ team_id: teamId, target_position: targetPosition }), fixedOutcomes)
  return api.get(`/api/hockey/public/hockey-poules/${pid}/simulate?${params.toString()}`)
}
export const getHockeyPoulePositionDistribution = (pid, teamId, fixedOutcomes = {}) => {
  const params = withFixedOutcomes(new URLSearchParams({ team_id: teamId, type: 'position_distribution' }), fixedOutcomes)
  return api.get(`/api/hockey/public/hockey-poules/${pid}/simulate?${params.toString()}`)
}
export const getCompetitionMatches = (cid) =>
  api.get(`/api/hockey/public/competitions/${cid}/matches`)
// Bouwt een querystring met 0+ herhaalde tag=...-params (AND-logica op de backend) plus extra params.
function tagQuery(tags, extra) {
  const params = new URLSearchParams(extra)
  for (const t of (tags || [])) params.append('tag', t)
  return params.toString()
}

export const getTagRanking = (tid, tags, stat, limit) =>
  api.get(`/api/hockey/public/tournaments/${tid}/query/ranking?${tagQuery(tags, { stat, limit })}`)
export const getTagRoundScorers = (tid, tags, stat, limit) =>
  api.get(`/api/hockey/public/tournaments/${tid}/query/round-scorers?${tagQuery(tags, { stat, limit })}`)
export const getTagRoundMatches = (tid, tags, stat, scope, limit) =>
  api.get(`/api/hockey/public/tournaments/${tid}/query/round-matches?${tagQuery(tags, { stat, scope, limit })}`)
export const getUpcomingMatches = (tid, tags, limit) =>
  api.get(`/api/hockey/public/tournaments/${tid}/query/upcoming-matches?${tagQuery(tags, { limit })}`)
export const getClubRanking = (tid, tags, limit) =>
  api.get(`/api/hockey/public/tournaments/${tid}/query/club-ranking?${tagQuery(tags, { limit })}`)
