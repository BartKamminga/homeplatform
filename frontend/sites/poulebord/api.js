import { api } from '../../core/api.js'

export const getTournaments   = ()    => api.get('/api/tournix/tournaments')
export const getPhases        = (tid) => api.get(`/api/tournix/tournaments/${tid}/phases`)
export const getPhaseStandings = (pid) => api.get(`/api/tournix/phases/${pid}/standings`)
