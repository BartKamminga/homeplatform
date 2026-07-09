import { api } from '../../core/api.js'

export const getTournaments    = ()    => api.get('/api/tournix/tournaments?stage=productie')
export const getPhases         = (tid) => api.get(`/api/tournix/tournaments/${tid}/phases`)
export const getPhaseStandings = (pid) => api.get(`/api/tournix/phases/${pid}/standings`)
export const getClubs          = ()    => api.get('/api/tournix/public/clubs')
export const getBoard          = (club, stage = 'productie') =>
  api.get(`/api/tournix/public/board?club=${encodeURIComponent(club)}&stage=${stage}`)
export const saveBoard         = (body) => api.post('/api/tournix/public/boards', body)
export const getBoardByCode    = (code) => api.get(`/api/tournix/public/boards/${code}`)
