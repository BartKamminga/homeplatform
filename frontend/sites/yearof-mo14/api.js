import { api } from '@core/api.js'

export const getStatus = () => api.get('/api/yearof-mo14/status')
export const getMe     = () => api.get('/api/yearof-mo14/me')

// Spelers
export const getPlayers    = ()          => api.get('/api/yearof-mo14/players')
export const getPlayer     = (id)        => api.get(`/api/yearof-mo14/players/${id}`)
export const createPlayer  = (body)      => api.post('/api/yearof-mo14/players', body)
export const updatePlayer  = (id, body)  => api.patch(`/api/yearof-mo14/players/${id}`, body)
export const deletePlayer  = (id)        => api.delete(`/api/yearof-mo14/players/${id}`)

// Teamlinkje (viewer-toegang)
export const validateTeamCode = (code) => api.get(`/api/yearof-mo14/team-links/validate?code=${encodeURIComponent(code)}`)
export const createTeamLink   = ()      => api.post('/api/yearof-mo14/team-links')
export const listTeamLinks    = ()      => api.get('/api/yearof-mo14/team-links')

// Oefenwedstrijden & bijzondere dagen
export const getEntries    = (kind)      => api.get(`/api/yearof-mo14/entries${kind ? `?kind=${kind}` : ''}`)
export const createEntry   = (body)      => api.post('/api/yearof-mo14/entries', body)
export const updateEntry   = (id, body)  => api.patch(`/api/yearof-mo14/entries/${id}`, body)
export const deleteEntry   = (id)        => api.delete(`/api/yearof-mo14/entries/${id}`)

// Samengevoegde tijdlijn (competitie + custom entries)
export const getTimeline     = ()          => api.get('/api/yearof-mo14/timeline')
export const getTimelineItem = (matchRef)  => api.get(`/api/yearof-mo14/timeline/${encodeURIComponent(matchRef)}`)
