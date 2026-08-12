import { api } from '@core/api.js'

export const KNOWN_SEASONS = ['2024-2025', '2025-2026', '2026-2027']

// Archief / captures
export const getCaptureSessions     = ()     => api.get('/api/capture/sessions')
export const getCaptureSessionItems = (sid)  => api.get(`/api/capture/sessions/${sid}/items`)
export const reprocessCaptures      = (body) => api.post('/api/capture/reprocess', body)

// Discovery + Vanger — TODO TS-01: prefix wordt /api/hockey/ na prefix-rename
export const getDiscoveryComps       = (season) => api.get(`/api/tournix/discovery/competitions${season ? `?season=${season}` : ''}`)
export const deleteEmptyCompetitions = (season) => api.delete(`/api/tournix/discovery/competitions/empty${season ? `?season=${season}` : ''}`)
export const getVangerQueue          = (status) => api.get(`/api/tournix/discovery/vanger/cmd-queue${status ? `?status=${status}` : ''}`)
