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
export const getTagRanking = (tid, tag, stat, limit) =>
  api.get(`/api/hockey/public/tournaments/${tid}/query/ranking?${new URLSearchParams({
    ...(tag ? { tag } : {}), stat, limit,
  })}`)
export const getTagRoundScorers = (tid, tag, stat, limit) =>
  api.get(`/api/hockey/public/tournaments/${tid}/query/round-scorers?${new URLSearchParams({
    ...(tag ? { tag } : {}), stat, limit,
  })}`)
export const getTagRoundMatches = (tid, tag, stat, scope, limit) =>
  api.get(`/api/hockey/public/tournaments/${tid}/query/round-matches?${new URLSearchParams({
    ...(tag ? { tag } : {}), stat, scope, limit,
  })}`)
export const getUpcomingMatches = (tid, tag, stat, limit) =>
  api.get(`/api/hockey/public/tournaments/${tid}/query/upcoming-matches?${new URLSearchParams({
    ...(tag ? { tag } : {}), stat, limit,
  })}`)
export const getWinStreak = (tid, tag, limit) =>
  api.get(`/api/hockey/public/tournaments/${tid}/query/win-streak?${new URLSearchParams({
    ...(tag ? { tag } : {}), limit,
  })}`)
export const getClubRanking = (tid, tag, limit) =>
  api.get(`/api/hockey/public/tournaments/${tid}/query/club-ranking?${new URLSearchParams({
    ...(tag ? { tag } : {}), limit,
  })}`)
