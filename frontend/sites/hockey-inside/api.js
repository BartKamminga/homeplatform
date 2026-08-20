import { api } from '@core/api.js'

export const KNOWN_SEASONS = ['2024-2025', '2025-2026', '2026-2027']

export const getMe = () => api.get('/api/auth/me')

// Publicaties
export const getPublications     = ()         => api.get('/api/hockey/publications')
export const createPublication   = (data)     => api.post('/api/hockey/publications', data)
export const updatePublication   = (id, data) => api.patch(`/api/hockey/publications/${id}`, data)
export const reorderPublications = (ids)      => api.patch('/api/hockey/publications/reorder', { ids })
export const deletePublication   = (id)       => api.delete(`/api/hockey/publications/${id}`)

// Competitie-koppelingen per publicatie
export const getPublicationComps   = (pid)              => api.get(`/api/hockey/publications/${pid}/competitions`)
export const addPublicationComp    = (pid, body)         => api.post(`/api/hockey/publications/${pid}/competitions`, body)
export const updatePublicationComp = (pid, linkId, body) => api.patch(`/api/hockey/publications/${pid}/competitions/${linkId}`, body)
export const removePublicationComp = (pid, linkId)       => api.delete(`/api/hockey/publications/${pid}/competitions/${linkId}`)
export const syncCompetition       = (cid)               => api.post(`/api/hockey/competitions/${cid}/sync`)

// Publicatie-tags
export const getPublicationTags       = ()       => api.get('/api/hockey/publications/tags')
export const addPublicationTag        = (body)   => api.post('/api/hockey/publications/tags', body)
export const removePublicationTag     = (tagId)  => api.delete(`/api/hockey/publications/tags/${tagId}`)
export const reorderPublicationTags   = (ids)    => api.patch('/api/hockey/publications/tags/reorder', { ids })
export const assignCompTag = (pid, linkId, tagId) =>
  api.post(`/api/hockey/publications/${pid}/competitions/${linkId}/tags`, { tag_id: tagId })
export const removeCompTag = (pid, linkId, tagId) =>
  api.delete(`/api/hockey/publications/${pid}/competitions/${linkId}/tags/${tagId}`)

// Archief / captures
export const getCaptureSessions     = (offset = 0, limit = 50) =>
  api.get(`/api/capture/sessions?offset=${offset}&limit=${limit}`)
export const getCaptureSessionItems = (sid)  => api.get(`/api/capture/sessions/${sid}/items`)
export const reprocessCaptures      = (body) => api.post('/api/capture/reprocess', body)
export const deleteCaptureSession   = (sid)  => api.delete(`/api/capture/sessions/${sid}`)
export const deleteOldCaptureSessions = (olderThanDays) =>
  api.delete(`/api/capture/sessions?older_than_days=${olderThanDays}`)

// Discovery + Vanger
export const getDiscoveryComps       = (season) => api.get(`/api/hockey/competitions${season ? `?season=${season}` : ''}`)
export const previewEmptyCompetitions = (season) => api.get(`/api/hockey/competitions/empty${season ? `?season=${season}` : ''}`)
export const deleteEmptyCompetitions  = (season) => api.delete(`/api/hockey/competitions/empty${season ? `?season=${season}` : ''}`)
export const deletePoule             = (pouleId) => api.delete(`/api/hockey/poules/${pouleId}`)
export const getVangerQueue          = (status) => api.get(`/api/hockey/vanger/cmd-queue${status ? `?status=${status}` : ''}`)

// Publieke detail-endpoints (wedstrijden + stand per poule)
export const getCompetitionMatches   = (cid)    => api.get(`/api/hockey/public/competitions/${cid}/matches`)
export const getHockeyPouleStandings = (pid)    => api.get(`/api/hockey/public/hockey-poules/${pid}/standings`)
