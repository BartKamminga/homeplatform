import { api } from '@core/api.js'

export const KNOWN_SEASONS = ['2024-2025', '2025-2026', '2026-2027']

export const getMe = () => api.get('/api/auth/me')

// Publicaties (tournament model)  — TODO TS-01: prefix wordt /api/hockey/ na prefix-rename
export const getTournaments     = ()         => api.get('/api/tournix/tournaments')
export const createTournament   = (data)     => api.post('/api/tournix/tournaments', data)
export const updateTournament   = (id, data) => api.patch(`/api/tournix/tournaments/${id}`, data)
export const reorderTournaments = (ids)      => api.patch('/api/tournix/tournaments/reorder', { ids })
export const deleteTournament   = (id)       => api.delete(`/api/tournix/tournaments/${id}`)

// Tournament-competitie koppelingen
export const getTournamentComps   = (tid)              => api.get(`/api/tournix/tournaments/${tid}/competitions`)
export const addTournamentComp    = (tid, body)         => api.post(`/api/tournix/tournaments/${tid}/competitions`, body)
export const updateTournamentComp = (tid, linkId, body) => api.patch(`/api/tournix/tournaments/${tid}/competitions/${linkId}`, body)
export const removeTournamentComp = (tid, linkId)       => api.delete(`/api/tournix/tournaments/${tid}/competitions/${linkId}`)
export const syncCompetition      = (cid)               => api.post(`/api/tournix/competitions/${cid}/sync`)

// Fase-tags
export const getFaseTags       = ()       => api.get('/api/tournix/fase-tags')
export const addFaseTag        = (body)   => api.post('/api/tournix/fase-tags', body)
export const removeFaseTag     = (tagId)  => api.delete(`/api/tournix/fase-tags/${tagId}`)
export const assignCompFaseTag = (tid, linkId, faseTagId) =>
  api.post(`/api/tournix/tournaments/${tid}/competitions/${linkId}/fase-tags`, { fase_tag_id: faseTagId })
export const removeCompFaseTag = (tid, linkId, faseTagId) =>
  api.delete(`/api/tournix/tournaments/${tid}/competitions/${linkId}/fase-tags/${faseTagId}`)

// Archief / captures
export const getCaptureSessions     = ()     => api.get('/api/capture/sessions')
export const getCaptureSessionItems = (sid)  => api.get(`/api/capture/sessions/${sid}/items`)
export const reprocessCaptures      = (body) => api.post('/api/capture/reprocess', body)

// Discovery + Vanger — TODO TS-01: prefix wordt /api/hockey/ na prefix-rename
export const getDiscoveryComps       = (season) => api.get(`/api/tournix/discovery/competitions${season ? `?season=${season}` : ''}`)
export const deleteEmptyCompetitions = (season) => api.delete(`/api/tournix/discovery/competitions/empty${season ? `?season=${season}` : ''}`)
export const getVangerQueue          = (status) => api.get(`/api/tournix/discovery/vanger/cmd-queue${status ? `?status=${status}` : ''}`)
