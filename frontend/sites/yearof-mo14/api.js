import { api } from '@core/api.js'
import { getStoredCode } from './gate.js'

// Publieke content-endpoints vereisen sinds fase 7 een geldige teamcode (of
// een homeplatform-login voor de beheerder) - hangt 'm automatisch aan als
// er een code in localStorage staat. Onschadelijk voor de beheerder: die is
// al ingelogd, dus de backend negeert deze code gewoon.
function withCode(url) {
  const code = getStoredCode()
  if (!code) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}code=${encodeURIComponent(code)}`
}

export const getStatus = () => api.get('/api/yearof-mo14/status')
export const getMe     = () => api.get('/api/yearof-mo14/me')

// Roadmap (platform-brede roadmap, gefilterd op deze site)
export const getRoadmapItems = () => api.get('/api/roadmap?site=yearof-mo14')

// Spelers
export const getPlayers    = ()          => api.get(withCode('/api/yearof-mo14/players'))
export const getPlayer     = (id)        => api.get(withCode(`/api/yearof-mo14/players/${id}`))
export const createPlayer  = (body)      => api.post('/api/yearof-mo14/players', body)
export const updatePlayer  = (id, body)  => api.patch(`/api/yearof-mo14/players/${id}`, body)
export const deletePlayer  = (id)        => api.delete(`/api/yearof-mo14/players/${id}`)
export async function uploadPlayerPhotoAdmin(id, file) {
  const fd = new FormData()
  fd.append('file', file, file.name || 'profiel.jpg')
  const res = await fetch(`/api/yearof-mo14/players/${id}/photo`, {
    method: 'POST', body: fd, headers: { Authorization: `Bearer ${localStorage.getItem('hp_token') || ''}` },
  })
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    throw new Error(errBody.detail || 'Upload mislukt')
  }
  return res.json()
}

// Teamlinkje (voorheen viewer-toegang - sinds 2026-09-13 niet meer verplicht
// om de site te bekijken; blijft bestaan als deelbaar linkje/optionele attributie)
export const createTeamLink   = (vangnetDays) => api.post(`/api/yearof-mo14/team-links${vangnetDays ? `?vangnet_days=${vangnetDays}` : ''}`)
export const listTeamLinks    = ()      => api.get('/api/yearof-mo14/team-links')

// Oefenwedstrijden & bijzondere dagen
export const getEntries    = (kind)      => api.get(withCode(`/api/yearof-mo14/entries${kind ? `?kind=${kind}` : ''}`))
export const createEntry   = (body)      => api.post('/api/yearof-mo14/entries', body)
export const updateEntry   = (id, body)  => api.patch(`/api/yearof-mo14/entries/${id}`, body)
export const deleteEntry   = (id)        => api.delete(`/api/yearof-mo14/entries/${id}`)

// Samengevoegde tijdlijn (competitie + custom entries)
export const getTimeline     = ()          => api.get(withCode('/api/yearof-mo14/timeline'))
export const getTimelineItem = (matchRef)  => api.get(withCode(`/api/yearof-mo14/timeline/${encodeURIComponent(matchRef)}`))
export const getStandings    = ()          => api.get(withCode('/api/yearof-mo14/standings'))

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

export const getPhotos           = (matchRef) => api.get(withCode(`/api/yearof-mo14/photos${matchRef ? `?match_ref=${encodeURIComponent(matchRef)}` : ''}`))
export const getPlayerPhotos     = (playerId) => api.get(withCode(`/api/yearof-mo14/photos?player_id=${encodeURIComponent(playerId)}`))
export const getPhotosModeration = ()         => api.get('/api/yearof-mo14/photos/moderation')
export const updatePhoto         = (id, body) => api.patch(`/api/yearof-mo14/photos/${id}`, body)
export const deletePhoto         = (id)       => api.delete(`/api/yearof-mo14/photos/${id}`)
export const tagPhoto            = (photoId, playerId) => api.post(`/api/yearof-mo14/photos/${photoId}/tags/${playerId}`)
export const untagPhoto          = (photoId, playerId) => api.delete(`/api/yearof-mo14/photos/${photoId}/tags/${playerId}`)

// Wedstrijd-invullink (contributor)
export const createContributorLink = (body) => api.post('/api/yearof-mo14/contributor-links', body)
export const listContributorLinks  = ()     => api.get('/api/yearof-mo14/contributor-links')
export const getContributorContext = (code) => api.get(`/api/yearof-mo14/contributor-links/${encodeURIComponent(code)}`)
export const getInterviewCandidates = (matchRef) => api.get(withCode(`/api/yearof-mo14/matches/${encodeURIComponent(matchRef)}/interview-candidates`))

// Doelpunten per speler per wedstrijd
export const getMatchGoals = (matchRef) => api.get(withCode(`/api/yearof-mo14/matches/${encodeURIComponent(matchRef)}/goals`))
export const setMatchGoal  = (matchRef, playerId, goals) => api.put(`/api/yearof-mo14/matches/${encodeURIComponent(matchRef)}/goals/${encodeURIComponent(playerId)}`, { goals })

// Positie van het foto-blok op de wedstrijdpagina (WYSIWYG-editor)
export const getPhotoBlockPosition = (matchRef) => api.get(`/api/yearof-mo14/matches/${encodeURIComponent(matchRef)}/photo-block`)
export const movePhotoBlock        = (matchRef, direction) => api.post(`/api/yearof-mo14/matches/${encodeURIComponent(matchRef)}/photo-block/move`, { direction })

// Verslagen & interviews
export const submitReport        = (body)      => api.post('/api/yearof-mo14/reports', body)
export const createReportDirect  = (body)      => api.post('/api/yearof-mo14/reports/direct', body)
export const addReportLink       = (reportId, body) => api.post(`/api/yearof-mo14/reports/${reportId}/links`, body)
export const updateReportLink    = (linkId, body)   => api.patch(`/api/yearof-mo14/reports/links/${linkId}`, body)
export const deleteReportLink    = (linkId)         => api.delete(`/api/yearof-mo14/reports/links/${linkId}`)
export const getReports          = (matchRef, reportType) => {
  const params = new URLSearchParams()
  if (matchRef) params.set('match_ref', matchRef)
  if (reportType) params.set('report_type', reportType)
  const qs = params.toString()
  return api.get(withCode(`/api/yearof-mo14/reports${qs ? `?${qs}` : ''}`))
}
export const getSpotlightReports  = ()         => api.get(withCode('/api/yearof-mo14/reports/spotlight'))
export const getReportsModeration = ()         => api.get('/api/yearof-mo14/reports/moderation')
export const updateReport        = (id, body)  => api.patch(`/api/yearof-mo14/reports/${id}`, body)
export const deleteReport        = (id)        => api.delete(`/api/yearof-mo14/reports/${id}`)
export const tagReport           = (reportId, playerId) => api.post(`/api/yearof-mo14/reports/${reportId}/tags/${playerId}`)
export const untagReport         = (reportId, playerId) => api.delete(`/api/yearof-mo14/reports/${reportId}/tags/${playerId}`)
export const moveReport          = (reportId, direction) => api.post(`/api/yearof-mo14/reports/${reportId}/move`, { direction })

// Profiellinkje (spelersprofiel zelf-bijwerken)
export const createProfileLink  = (playerId) => api.post(`/api/yearof-mo14/profile-links?player_id=${encodeURIComponent(playerId)}`)
export const listProfileLinks   = ()          => api.get('/api/yearof-mo14/profile-links')
export const getProfileLinkContext = (code)   => api.get(`/api/yearof-mo14/profile-links/${encodeURIComponent(code)}`)
export async function uploadProfilePhoto(code, file) {
  const fd = new FormData()
  fd.append('file', file, file.name || 'profiel.jpg')
  const res = await fetch(`/api/yearof-mo14/profile-links/${encodeURIComponent(code)}/photo`, { method: 'POST', body: fd })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || 'Upload mislukt')
  }
  return res.json()
}
export const submitPlayerEdit   = (body)      => api.post('/api/yearof-mo14/player-edits', body)
export const getPlayerEditsModeration = ()    => api.get('/api/yearof-mo14/player-edits/moderation')
export const applyPlayerEdit    = (id)        => api.post(`/api/yearof-mo14/player-edits/${id}/apply`)
export const rejectPlayerEdit   = (id)        => api.delete(`/api/yearof-mo14/player-edits/${id}`)

// Actie-instellingen (doelbedrag/voortgang/betaallink)
export const getActionSettings    = ()     => api.get('/api/yearof-mo14/action')
export const updateActionSettings = (body) => api.patch('/api/yearof-mo14/action', body)
