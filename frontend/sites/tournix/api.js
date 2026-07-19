import { api } from '@core/api.js'

export const getTournaments         = ()          => api.get('/api/tournix/tournaments')
export const getTournament          = (id)        => api.get(`/api/tournix/tournaments/${id}`)
export const createTournament       = (data)      => api.post('/api/tournix/tournaments', data)
export const updateTournament       = (id, data)  => api.patch(`/api/tournix/tournaments/${id}`, data)
export const deleteTournament       = (id)        => api.delete(`/api/tournix/tournaments/${id}`)
export const getMe                  = ()          => api.get('/api/me')

export const getTeams               = (tid)       => api.get(`/api/tournix/tournaments/${tid}/teams`)
export const createTeam             = (tid, data) => api.post(`/api/tournix/tournaments/${tid}/teams`, data)
export const updateTeam             = (id, data)  => api.patch(`/api/tournix/teams/${id}`, data)
export const deleteTeam             = (id)        => api.delete(`/api/tournix/teams/${id}`)

export const getFields              = (tid)       => api.get(`/api/tournix/tournaments/${tid}/fields`)
export const createField            = (tid, data) => api.post(`/api/tournix/tournaments/${tid}/fields`, data)
export const deleteField            = (id)        => api.delete(`/api/tournix/fields/${id}`)

export const getMatches             = (tid)       => api.get(`/api/tournix/tournaments/${tid}/matches`)
export const createMatch            = (tid, data) => api.post(`/api/tournix/tournaments/${tid}/matches`, data)
export const updateMatch            = (mid, data) => api.patch(`/api/tournix/matches/${mid}`, data)
export const deleteMatch            = (mid)       => api.delete(`/api/tournix/matches/${mid}`)
export const setResult              = (mid, data) => api.patch(`/api/tournix/matches/${mid}/result`, data)

export const getStandings           = (tid)       => api.get(`/api/tournix/tournaments/${tid}/standings`)

export const predict                = (mid, data) => api.post(`/api/tournix/matches/${mid}/predict`, data)
export const getPredictions         = (mid)       => api.get(`/api/tournix/matches/${mid}/predictions`)

export const updateTournamentStage  = (tid, stage)  => api.patch(`/api/tournix/tournaments/${tid}`, { stage })
export const saveSnapshot           = (tid, round)   => api.post(`/api/tournix/tournaments/${tid}/snapshots?round=${round}`)
export const getSnapshots           = (tid)          => api.get(`/api/tournix/tournaments/${tid}/snapshots`)
export const getSnapshot            = (tid, round)   => api.get(`/api/tournix/tournaments/${tid}/snapshots/${round}`)

export const getPools               = (tid)          => api.get(`/api/tournix/tournaments/${tid}/pools`)
export const createPool             = (tid, body)    => api.post(`/api/tournix/tournaments/${tid}/pools`, body)
export const deletePool             = (pid)          => api.delete(`/api/tournix/pools/${pid}`)
export const assignTeamPool         = (teamId, poolId) => api.patch(`/api/tournix/teams/${teamId}/pool`, { pool_id: poolId })
export const autoAssignPools        = (tid)          => api.post(`/api/tournix/tournaments/${tid}/auto-assign`)
export const updateTournamentPools  = (tid, num_pools, pool_type) => api.patch(`/api/tournix/tournaments/${tid}`, { num_pools, pool_type })

export async function generateKnockout(tid) {
  return api.post(`/api/tournix/tournaments/${tid}/generate-knockout`)
}
export async function updateTournamentKnockout(tid, knockout_type, knockout_advance) {
  return api.patch(`/api/tournix/tournaments/${tid}`, { knockout_type, knockout_advance })
}

export const getClubs    = ()          => api.get('/api/tournix/clubs')
export const createClub  = (data)      => api.post('/api/tournix/clubs', data)
export const updateClub  = (id, data)  => api.patch(`/api/tournix/clubs/${id}`, data)
export const deleteClub  = (id)        => api.delete(`/api/tournix/clubs/${id}`)

export const importTournament = (data) => api.post('/api/tournix/import', data)
export const copyTournament   = (tid)  => api.post(`/api/tournix/tournaments/${tid}/copy`)

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
export const setPhaseFields           = (pid, field_ids) => api.post(`/api/tournix/phases/${pid}/fields`, { field_ids })
export const planPhaseSchedule        = (pid, startTime) => api.post(`/api/tournix/phases/${pid}/plan-schedule`, { start_time: startTime || null })

export const getCaptureSessions       = ()        => api.get('/api/capture/sessions')
export const getCaptureSessionItems   = (sid)     => api.get(`/api/capture/sessions/${sid}/items`)
