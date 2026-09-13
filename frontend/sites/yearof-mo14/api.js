import { api } from '@core/api.js'

export const getStatus = () => api.get('/api/yearof-mo14/status')
export const getMe     = () => api.get('/api/yearof-mo14/me')

// Roadmap (platform-brede roadmap, gefilterd op deze site)
export const getRoadmapItems = () => api.get('/api/roadmap?site=yearof-mo14')

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

// Foto's - upload is een FormData-post (geen JSON), rechtstreeks via fetch
// i.p.v. api.post, en zonder Authorization-header (publiek, teamcode i.p.v. login).
export async function uploadPhoto(file, { matchRef, photoType, code }) {
  const fd = new FormData()
  fd.append('file', file, file.name || 'foto.jpg')
  fd.append('match_ref', matchRef)
  fd.append('photo_type', photoType)
  fd.append('code', code)
  const res = await fetch('/api/yearof-mo14/photos', { method: 'POST', body: fd })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || 'Upload mislukt')
  }
  return res.json()
}

export const getPhotos           = (matchRef) => api.get(`/api/yearof-mo14/photos${matchRef ? `?match_ref=${encodeURIComponent(matchRef)}` : ''}`)
export const getPlayerPhotos     = (playerId) => api.get(`/api/yearof-mo14/photos?player_id=${encodeURIComponent(playerId)}`)
export const getPhotosModeration = ()         => api.get('/api/yearof-mo14/photos/moderation')
export const updatePhoto         = (id, body) => api.patch(`/api/yearof-mo14/photos/${id}`, body)
export const deletePhoto         = (id)       => api.delete(`/api/yearof-mo14/photos/${id}`)
export const tagPhoto            = (photoId, playerId) => api.post(`/api/yearof-mo14/photos/${photoId}/tags/${playerId}`)
export const untagPhoto          = (photoId, playerId) => api.delete(`/api/yearof-mo14/photos/${photoId}/tags/${playerId}`)

// Wedstrijd-invullink (contributor)
export const createContributorLink = (body) => api.post('/api/yearof-mo14/contributor-links', body)
export const listContributorLinks  = ()     => api.get('/api/yearof-mo14/contributor-links')
export const getContributorContext = (code) => api.get(`/api/yearof-mo14/contributor-links/${encodeURIComponent(code)}`)

// Verslagen & interviews
export const submitReport        = (body)      => api.post('/api/yearof-mo14/reports', body)
export const createReportDirect  = (body)      => api.post('/api/yearof-mo14/reports/direct', body)
export const getReports          = (matchRef, reportType) => {
  const params = new URLSearchParams()
  if (matchRef) params.set('match_ref', matchRef)
  if (reportType) params.set('report_type', reportType)
  const qs = params.toString()
  return api.get(`/api/yearof-mo14/reports${qs ? `?${qs}` : ''}`)
}
export const getReportsModeration = ()         => api.get('/api/yearof-mo14/reports/moderation')
export const updateReport        = (id, body)  => api.patch(`/api/yearof-mo14/reports/${id}`, body)
export const deleteReport        = (id)        => api.delete(`/api/yearof-mo14/reports/${id}`)
export const tagReport           = (reportId, playerId) => api.post(`/api/yearof-mo14/reports/${reportId}/tags/${playerId}`)
export const untagReport         = (reportId, playerId) => api.delete(`/api/yearof-mo14/reports/${reportId}/tags/${playerId}`)

// Profiellinkje (spelersprofiel zelf-bijwerken)
export const createProfileLink  = (playerId) => api.post(`/api/yearof-mo14/profile-links?player_id=${encodeURIComponent(playerId)}`)
export const listProfileLinks   = ()          => api.get('/api/yearof-mo14/profile-links')
export const getProfileLinkContext = (code)   => api.get(`/api/yearof-mo14/profile-links/${encodeURIComponent(code)}`)
export const submitPlayerEdit   = (body)      => api.post('/api/yearof-mo14/player-edits', body)
export const getPlayerEditsModeration = ()    => api.get('/api/yearof-mo14/player-edits/moderation')
export const applyPlayerEdit    = (id)        => api.post(`/api/yearof-mo14/player-edits/${id}/apply`)
export const rejectPlayerEdit   = (id)        => api.delete(`/api/yearof-mo14/player-edits/${id}`)
