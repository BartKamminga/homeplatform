import { api } from '../../core/api.js'

export const getTournaments         = ()    => api.get('/api/tournix/public/tournaments')
export const getDiscoverySeason     = ()    => api.get('/api/hockey/public/season')
export const getHockeyPublications  = ()    => api.get('/api/hockey/public/publications')
export const getPhases         = (tid) => api.get(`/api/tournix/public/tournaments/${tid}/phases`)
export const getPhaseStandings = (pid) => api.get(`/api/tournix/public/phases/${pid}/standings`)
export const getClubs          = ()    => api.get('/api/hockey/public/clubs')
export const saveBoard         = (body) => api.post('/api/tournix/public/boards', body)
export const getBoardByCode    = (code) => api.get(`/api/tournix/public/boards/${code}`)
export const getPoolMatches    = (phaseId, poolName) =>
  api.get(`/api/tournix/public/phases/${phaseId}/pool-matches?pool=${encodeURIComponent(poolName)}`)
export const searchPools       = (q, season = '2026-2027') =>
  api.get(`/api/tournix/public/search?q=${encodeURIComponent(q)}&season=${encodeURIComponent(season)}`)
export const searchDiscoveryPools = (q) =>
  api.get(`/api/hockey/public/search?q=${encodeURIComponent(q)}`)
export const getTournamentCompetitionStandings = (tid) =>
  api.get(`/api/hockey/public/tournaments/${tid}/competition-standings`)
export const getHockeyPouleStandings = (pid) =>
  api.get(`/api/hockey/public/hockey-poules/${pid}/standings`)
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
export const getWinStreak = (tid, tags, limit) =>
  api.get(`/api/hockey/public/tournaments/${tid}/query/win-streak?${tagQuery(tags, { limit })}`)
export const getClubRanking = (tid, tags, limit) =>
  api.get(`/api/hockey/public/tournaments/${tid}/query/club-ranking?${tagQuery(tags, { limit })}`)
