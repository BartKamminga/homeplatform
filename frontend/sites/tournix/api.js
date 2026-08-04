import { api } from '@core/api.js'

export const KNOWN_SEASONS = ['2024-2025', '2025-2026', '2026-2027']

export const getTournaments         = ()          => api.get('/api/tournix/tournaments')
export const getTournament          = (id)        => api.get(`/api/tournix/tournaments/${id}`)
export const createTournament       = (data)      => api.post('/api/tournix/tournaments', data)
export const updateTournament       = (id, data)  => api.patch(`/api/tournix/tournaments/${id}`, data)
export const reorderTournaments     = (ids)       => api.patch('/api/tournix/tournaments/reorder', { ids })
export const deleteTournament       = (id)        => api.delete(`/api/tournix/tournaments/${id}`)
export const getMe                  = ()          => api.get('/api/auth/me')

export const getTeams               = (tid)       => api.get(`/api/tournix/tournaments/${tid}/teams`)
export const createTeam             = (tid, data) => api.post(`/api/tournix/tournaments/${tid}/teams`, data)
export const updateTeam             = (id, data)  => api.patch(`/api/tournix/teams/${id}`, data)
export const deleteTeam             = (id)        => api.delete(`/api/tournix/teams/${id}`)

export const getMatches             = (tid)       => api.get(`/api/tournix/tournaments/${tid}/matches`)
export const createMatch            = (tid, data) => api.post(`/api/tournix/tournaments/${tid}/matches`, data)
export const updateMatch            = (mid, data) => api.patch(`/api/tournix/matches/${mid}`, data)
export const deleteMatch            = (mid)       => api.delete(`/api/tournix/matches/${mid}`)
export const setResult              = (mid, data) => api.patch(`/api/tournix/matches/${mid}/result`, data)

export const getStandings           = (tid)       => api.get(`/api/tournix/tournaments/${tid}/standings`)

export const getPhases              = (tid)        => api.get(`/api/tournix/tournaments/${tid}/phases`)
export const createPhase            = (tid, data)  => api.post(`/api/tournix/tournaments/${tid}/phases`, data)
export const updatePhase            = (pid, data)  => api.patch(`/api/tournix/phases/${pid}`, data)
export const deletePhase            = (pid)        => api.delete(`/api/tournix/phases/${pid}`)
export const setPhaseTeams          = (pid, teams) => api.post(`/api/tournix/phases/${pid}/teams`, { teams })
export const phaseTeamsFromStandings = (pid, positions) => api.post(`/api/tournix/phases/${pid}/teams/from-standings`, { positions })
export const generatePhaseSchedule  = (pid)        => api.post(`/api/tournix/phases/${pid}/generate-schedule`)
export const getPhaseStandings      = (pid)        => api.get(`/api/tournix/phases/${pid}/standings`)
export const createPoolInPhase      = (pid, data)  => api.post(`/api/tournix/phases/${pid}/pools`, data)
export const deletePoolInPhase      = (pid, poolId) => api.delete(`/api/tournix/phases/${pid}/pools/${poolId}`)
export const autoPoolsInPhase       = (pid, data)  => api.post(`/api/tournix/phases/${pid}/auto-pools`, data)
export const preAllocatePhaseTeams  = (pid, positions) => api.post(`/api/tournix/phases/${pid}/teams/pre-allocate`, { positions })
export const resolvePhaseplaceholders = (pid)      => api.post(`/api/tournix/phases/${pid}/resolve-placeholders`)
export const planPhaseSchedule        = (pid, startTime) => api.post(`/api/tournix/phases/${pid}/plan-schedule`, { start_time: startTime || null })

export const getClubs = () => api.get('/api/tournix/clubs')

export const importTournament = (data) => api.post('/api/tournix/import', data)
export const copyTournament   = (tid)  => api.post(`/api/tournix/tournaments/${tid}/copy`)

export const getCaptureSessions       = ()        => api.get('/api/capture/sessions')
export const getCaptureSessionItems   = (sid)     => api.get(`/api/capture/sessions/${sid}/items`)
export const reprocessCaptures        = (body)    => api.post('/api/capture/reprocess', body)

// Seizoensplanner
export const getDiscoveryComps        = (season)   => api.get(`/api/tournix/discovery/competitions${season ? `?season=${season}` : ''}`)
export const deleteEmptyCompetitions  = (season)   => api.delete(`/api/tournix/discovery/competitions/empty${season ? `?season=${season}` : ''}`)
export const getVangerQueue    = (status) =>
  api.get(`/api/tournix/discovery/vanger/cmd-queue${status ? `?status=${status}` : ''}`)

// Tournament-competitie koppelingen
export const getTournamentComps    = (tid)                  => api.get(`/api/tournix/tournaments/${tid}/competitions`)
export const addTournamentComp     = (tid, body)            => api.post(`/api/tournix/tournaments/${tid}/competitions`, body)
export const updateTournamentComp  = (tid, linkId, body)    => api.patch(`/api/tournix/tournaments/${tid}/competitions/${linkId}`, body)
export const removeTournamentComp  = (tid, linkId)          => api.delete(`/api/tournix/tournaments/${tid}/competitions/${linkId}`)

// Globale fase-tags (gedeeld over alle publicaties)
export const getFaseTags    = ()        => api.get('/api/tournix/fase-tags')
export const addFaseTag     = (body)    => api.post('/api/tournix/fase-tags', body)
export const removeFaseTag  = (tagId)   => api.delete(`/api/tournix/fase-tags/${tagId}`)

// Fase-tags per competitie-koppeling
export const assignCompFaseTag = (tid, linkId, faseTagId) =>
  api.post(`/api/tournix/tournaments/${tid}/competitions/${linkId}/fase-tags`, { fase_tag_id: faseTagId })
export const removeCompFaseTag = (tid, linkId, faseTagId) =>
  api.delete(`/api/tournix/tournaments/${tid}/competitions/${linkId}/fase-tags/${faseTagId}`)

// Discovery competitie detail
export const getTournamentCompetitionStandings = (tid) => api.get(`/api/tournix/public/tournaments/${tid}/competition-standings`)
export const getCompetitionMatches = (cid)             => api.get(`/api/tournix/public/competitions/${cid}/matches`)
export const syncCompetition       = (cid)             => api.post(`/api/tournix/competitions/${cid}/sync`)
