import { api } from '@core/api.js'

export const getTournaments         = ()          => api.get('/api/tournix/tournaments')
export const getTournament          = (id)        => api.get(`/api/tournix/tournaments/${id}`)
export const createTournament       = (data)      => api.post('/api/tournix/tournaments', data)
export const updateTournament       = (id, data)  => api.patch(`/api/tournix/tournaments/${id}`, data)

export const getTeams               = (tid)       => api.get(`/api/tournix/tournaments/${tid}/teams`)
export const createTeam             = (tid, data) => api.post(`/api/tournix/tournaments/${tid}/teams`, data)
export const deleteTeam             = (id)        => api.delete(`/api/tournix/teams/${id}`)

export const getFields              = (tid)       => api.get(`/api/tournix/tournaments/${tid}/fields`)
export const createField            = (tid, data) => api.post(`/api/tournix/tournaments/${tid}/fields`, data)

export const getMatches             = (tid)       => api.get(`/api/tournix/tournaments/${tid}/matches`)
export const createMatch            = (tid, data) => api.post(`/api/tournix/tournaments/${tid}/matches`, data)
export const setResult              = (mid, data) => api.patch(`/api/tournix/matches/${mid}/result`, data)

export const getStandings           = (tid)       => api.get(`/api/tournix/tournaments/${tid}/standings`)

export const predict                = (mid, data) => api.post(`/api/tournix/matches/${mid}/predict`, data)
export const getPredictions         = (mid)       => api.get(`/api/tournix/matches/${mid}/predictions`)

export const updateTournamentStage  = (tid, stage)  => api.patch(`/api/tournix/tournaments/${tid}`, { stage })
export const saveSnapshot           = (tid, round)   => api.post(`/api/tournix/tournaments/${tid}/snapshots?round=${round}`)
export const getSnapshots           = (tid)          => api.get(`/api/tournix/tournaments/${tid}/snapshots`)
export const getSnapshot            = (tid, round)   => api.get(`/api/tournix/tournaments/${tid}/snapshots/${round}`)
