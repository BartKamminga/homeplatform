import { api as coreApi } from '@core/api.js'
import { notifyDataChanged } from './dataChanged.js'

// Elke geslaagde schrijfactie meldt zich (item 1239): de beheerstudio ververst
// dan de preview naast het bewerkpaneel.
const mutate = fn => (...args) => fn(...args).then(res => { notifyDataChanged(); return res })
const api = {
  get: coreApi.get,
  post: mutate(coreApi.post),
  put: mutate(coreApi.put),
  patch: mutate(coreApi.patch),
  delete: mutate(coreApi.delete),
}
import { getActiveCode } from './gate.js'

// Publieke content-endpoints vereisen sinds fase 7 een geldige teamcode (of
// een homeplatform-login voor de beheerder) - hangt 'm automatisch aan als
// er een code in localStorage staat. Onschadelijk voor de beheerder: die is
// al ingelogd, dus de backend negeert deze code gewoon. Op een losse
// wedstrijdpagina is dat de wedstrijdlink-code i.p.v. de teamcode (item 1186).
function withCode(url) {
  const code = getActiveCode()
  if (!code) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}code=${encodeURIComponent(code)}`
}

export const getStatus = () => api.get('/api/yearof-mo14/status')
export const getMe     = () => api.get('/api/yearof-mo14/me')

// Landelijke MO14 Topklasse-ranglijsten (poulebord's query-widget-endpoints,
// publiek net als /action - geen teamcode nodig). Tournament-id en tag zijn
// bewust hardcoded, zelfde single-tenant aanpak als de rest van deze site.
const MO14_TOURNAMENT_ID = '05615c6e-5c10-4151-b8a1-691779f8f467'
export const getNationalRanking = (stat = 'points', limit = 10) =>
  api.get(`/api/hockey/public/tournaments/${MO14_TOURNAMENT_ID}/query/ranking?tag=Topklasse&stat=${stat}&limit=${limit}`)
export const getNationalUpcomingMatches = (limit = 5) =>
  api.get(`/api/hockey/public/tournaments/${MO14_TOURNAMENT_ID}/query/upcoming-matches?tag=Topklasse&limit=${limit}`)

// Competitie-tab (items 1229-1232): config + featureflag, en openbare hockey-data
export const getCompetition        = ()       => api.get('/api/yearof-mo14/competition')
export const setCompetitionPublic  = (pub)    => api.put('/api/yearof-mo14/competition/public', { public: pub })
// Blokken per pagina live/concept (item 1239) - concept = alleen voor de platformbeheerder
export const getConceptBlocks      = ()       => api.get('/api/yearof-mo14/blocks')
export const setBlockLive          = (id, live) => api.put(`/api/yearof-mo14/blocks/${encodeURIComponent(id)}`, { live })
export const getPouleMatches       = (pid)    => api.get(`/api/hockey/public/hockey-poules/${pid}/matches`)
export const getPositionDistribution = (pid, teamId) =>
  api.get(`/api/hockey/public/hockey-poules/${pid}/simulate?team_id=${teamId}&type=position_distribution`)
export const getRegroupingForecast = (tid)    => api.get(`/api/hockey/public/tournaments/${tid}/query/regrouping-forecast`)
export const getCompetitionStandings = (tid)  => api.get(`/api/hockey/public/tournaments/${tid}/competition-standings`)

// Is de bezoeker een ingelogde platformbeheerder? Bewust kale fetch: de
// gedeelde api-client stuurt bij een 401 naar de loginpagina, en dat mag een
// bezoeker met een verlopen login op de publieke site niet overkomen.
export async function checkPlatformAdmin() {
  const token = localStorage.getItem('hp_token')
  if (!token) return false
  try {
    const res = await fetch('/api/yearof-mo14/me', { headers: { Authorization: `Bearer ${token}` } })
    return res.ok ? !!(await res.json()).is_platform_admin : false
  } catch {
    return false
  }
}

// Roadmap (platform-brede roadmap, gefilterd op deze site)
export const getRoadmapItems = () => api.get('/api/roadmap?site=yearof-mo14')

// Spelers
export const getPlayers    = ()          => api.get(withCode('/api/yearof-mo14/players'))
export const getPlayer     = (id)        => api.get(withCode(`/api/yearof-mo14/players/${id}`))
export const createPlayer  = (body)      => api.post('/api/yearof-mo14/players', body)
export const updatePlayer  = (id, body)  => api.patch(`/api/yearof-mo14/players/${id}`, body)
export const deletePlayer  = (id)        => api.delete(`/api/yearof-mo14/players/${id}`)
export const archivePlayer = (id)        => api.post(`/api/yearof-mo14/players/${id}/archive`)
export const restorePlayer = (id)        => api.post(`/api/yearof-mo14/players/${id}/restore`)
// Beheerder-only - inclusief gearchiveerde spelers (verborgen op de publieke site)
export const getPlayersModeration = ()   => api.get('/api/yearof-mo14/players/moderation')
export const getPlayerModeration  = (id) => api.get(`/api/yearof-mo14/players/moderation/${id}`)
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
  notifyDataChanged()
  return res.json()
}

// Teamlinkje (viewer-toegang)
export const validateTeamCode = (code) => api.get(`/api/yearof-mo14/team-links/validate?code=${encodeURIComponent(code)}`)
export const createTeamLink   = (vangnetDays) => api.post(`/api/yearof-mo14/team-links${vangnetDays ? `?vangnet_days=${vangnetDays}` : ''}`)
export const listTeamLinks    = ()      => api.get('/api/yearof-mo14/team-links')

// Korte deel-links: sitelink (team_code), wedstrijdlink (match_ref) of
// spelerslink (player_id) - item 1186
export const createShortLink    = (body)  => api.post('/api/yearof-mo14/short-links', body)
export const revokeShortLink    = (code)  => api.post(`/api/yearof-mo14/short-links/${encodeURIComponent(code)}/revoke`)
export const validateShortLink  = (code)  => api.get(`/api/yearof-mo14/short-links/${encodeURIComponent(code)}/validate`)
export const getPlayerLinkView  = (code)  => api.get(`/api/yearof-mo14/player-links/${encodeURIComponent(code)}`)

// Bezoeken per link + overzicht van alle linkjes (item 1193)
export const postVisit       = (body) => api.post('/api/yearof-mo14/visits', body)
export const getLinkOverview = ()     => api.get('/api/yearof-mo14/link-overview')

// Oefenwedstrijden & bijzondere dagen
export const getEntries    = (kind)      => api.get(withCode(`/api/yearof-mo14/entries${kind ? `?kind=${kind}` : ''}`))
export const createEntry   = (body)      => api.post('/api/yearof-mo14/entries', body)
export const updateEntry   = (id, body)  => api.patch(`/api/yearof-mo14/entries/${id}`, body)
export const deleteEntry   = (id)        => api.delete(`/api/yearof-mo14/entries/${id}`)
export const archiveEntry  = (id)        => api.post(`/api/yearof-mo14/entries/${id}/archive`)
export const restoreEntry  = (id)        => api.post(`/api/yearof-mo14/entries/${id}/restore`)

// Samengevoegde tijdlijn (competitie + custom entries)
export const getTimeline     = ()          => api.get(withCode('/api/yearof-mo14/timeline'))
export const getTimelineItem = (matchRef)  => api.get(withCode(`/api/yearof-mo14/timeline/${encodeURIComponent(matchRef)}`))
export const getStandings    = ()          => api.get(withCode('/api/yearof-mo14/standings'))
// Beheerder-only - inclusief gearchiveerde dagen (verborgen op de publieke site)
export const getTimelineModeration     = ()          => api.get('/api/yearof-mo14/timeline/moderation')
export const getTimelineItemModeration = (matchRef)  => api.get(`/api/yearof-mo14/timeline/moderation/${encodeURIComponent(matchRef)}`)

// Foto's - upload is een FormData-post (geen JSON), rechtstreeks via fetch
// i.p.v. api.post, en zonder Authorization-header (publiek, teamcode i.p.v. login).
export async function uploadPhoto(file, { matchRef, reportId, photoType, code }) {
  const fd = new FormData()
  fd.append('file', file, file.name || 'foto.jpg')
  if (matchRef) fd.append('match_ref', matchRef)
  if (reportId) fd.append('report_id', reportId)
  fd.append('photo_type', photoType)
  if (code) fd.append('code', code)
  // Beheerder (ingelogd): login meesturen, zodat de upload als "Beheerder"
  // herkend wordt en blijft werken zodra uploaden een code/login vereist (1203).
  const token = localStorage.getItem('hp_token')
  const res = await fetch('/api/yearof-mo14/photos', {
    method: 'POST', body: fd, headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || 'Upload mislukt')
  }
  notifyDataChanged()
  return res.json()
}

export const getPhotos           = (matchRef, highlightsOnly = false) => {
  const params = new URLSearchParams()
  if (matchRef) params.set('match_ref', matchRef)
  if (highlightsOnly) params.set('highlights_only', '1')
  const qs = params.toString()
  return api.get(withCode(`/api/yearof-mo14/photos${qs ? `?${qs}` : ''}`))
}
export const getPhotosByReport   = (reportId) => api.get(withCode(`/api/yearof-mo14/photos?report_id=${encodeURIComponent(reportId)}`))
export const getPlayerPhotos     = (playerId) => api.get(withCode(`/api/yearof-mo14/photos?player_id=${encodeURIComponent(playerId)}`))
// Favoriete foto's per speelster (item 1199) - max 6, alleen beheerder kiest
export const getPlayerFavorites  = (playerId) => api.get(withCode(`/api/yearof-mo14/players/${encodeURIComponent(playerId)}/favorites`))
export const getPlayerPhotosForFavorites = (playerId) => api.get(`/api/yearof-mo14/players/${encodeURIComponent(playerId)}/photos/moderation`)
// Speelster van de week (item 1200) - max 1; playerId null = niemand
export const getPlayerSpotlight  = ()         => api.get(withCode('/api/yearof-mo14/player-spotlight'))
export const setPlayerSpotlight  = (playerId) => api.put('/api/yearof-mo14/player-spotlight', { player_id: playerId })
export const setPlayerFavorite   = (playerId, photoId, favorite) =>
  api.put(`/api/yearof-mo14/players/${encodeURIComponent(playerId)}/favorites/${encodeURIComponent(photoId)}`, { favorite })
export const getPhotosModeration = ()         => api.get('/api/yearof-mo14/photos/moderation')
// Fotobeheer-werkbak (item 1213): lijst met tags/favorieten/bron + bulk-acties
export const getPhotosManager    = ()         => api.get('/api/yearof-mo14/photos/manager')
export const bulkPhotos          = (ids, action, value = null) => api.post('/api/yearof-mo14/photos/bulk', { ids, action, value })
export const updatePhoto         = (id, body) => api.patch(`/api/yearof-mo14/photos/${id}`, body)
export const deletePhoto         = (id)       => api.delete(`/api/yearof-mo14/photos/${id}`)
export const tagPhoto            = (photoId, playerId) => api.post(`/api/yearof-mo14/photos/${photoId}/tags/${playerId}`)
export const untagPhoto          = (photoId, playerId) => api.delete(`/api/yearof-mo14/photos/${photoId}/tags/${playerId}`)
export const likePhoto           = (photoId) => api.post(withCode(`/api/yearof-mo14/photos/${photoId}/like`))
export const unlikePhoto         = (photoId) => api.delete(withCode(`/api/yearof-mo14/photos/${photoId}/like`))

// Wedstrijd-invullink (contributor)
export const createContributorLink = (body) => api.post('/api/yearof-mo14/contributor-links', body)
export const listContributorLinks  = ()     => api.get('/api/yearof-mo14/contributor-links')
export const getContributorContext = (code) => api.get(`/api/yearof-mo14/contributor-links/${encodeURIComponent(code)}`)
export const deleteContributorLink = (code) => api.delete(`/api/yearof-mo14/contributor-links/${encodeURIComponent(code)}`)
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
export const getReports          = (matchRef, reportType, highlightsOnly = false) => {
  const params = new URLSearchParams()
  if (matchRef) params.set('match_ref', matchRef)
  if (reportType) params.set('report_type', reportType)
  if (highlightsOnly) params.set('highlights_only', '1')
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
export const likeReport          = (reportId) => api.post(withCode(`/api/yearof-mo14/reports/${reportId}/like`))
export const unlikeReport        = (reportId) => api.delete(withCode(`/api/yearof-mo14/reports/${reportId}/like`))

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

// Sponsors (op de actiepagina) - publiek net als /action, geen teamcode nodig
export const getSponsors    = ()          => api.get('/api/yearof-mo14/sponsors')
export const createSponsor  = (body)      => api.post('/api/yearof-mo14/sponsors', body)
export const updateSponsor  = (id, body)  => api.patch(`/api/yearof-mo14/sponsors/${id}`, body)
export const deleteSponsor  = (id)        => api.delete(`/api/yearof-mo14/sponsors/${id}`)
export const moveSponsor    = (id, direction) => api.post(`/api/yearof-mo14/sponsors/${id}/move`, { direction })
export async function uploadSponsorLogo(id, file) {
  const fd = new FormData()
  fd.append('file', file, file.name || 'logo.png')
  const res = await fetch(`/api/yearof-mo14/sponsors/${id}/logo`, {
    method: 'POST', body: fd, headers: { Authorization: `Bearer ${localStorage.getItem('hp_token') || ''}` },
  })
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    throw new Error(errBody.detail || 'Upload mislukt')
  }
  return res.json()
}
